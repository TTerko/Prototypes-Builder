/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

const request = require("request");
const fetch = require('node-fetch');	
const { WebClient } = require('@slack/web-api');
// var db = require('./features/db-integration');
var app = {};
var db = {};

const web = new WebClient(process.env.botToken);

slackHeaders = { 'Content-type' : 'application/json' ,
		'Authorization': 'Bearer xoxb-155157046448-778754667713-JrVbKjyS8mFMGxmZ1hCToLs2'};


headers = { "Content-type" : "application/json",
	'Authorization': 'Basic b182563c74cc832f104816a9ecdeee15'};


module.exports = {
	init: function (botApp, database)
	{
		app = botApp;
		db = database;
	},

	open: async function (ack, payload, context)
	{
		await openStartMenu(payload, context);
	},

	onUserSelected: async function(ack, body, context)
	{
		await openLoadingMenu(body, context, "Loading user ");
		
		var user = body.actions[0].selected_user;

		await openBranchSelectionMenu(body.view.id, context.botToken, user, body.user.id);
	},

	onBranchSelected: async function(ack, body, context)
	{
		await openLoadingMenu(body, context, "Preparing branch ");

		var value =  JSON.parse(body.actions[0].selected_option.value);

		var user = value.user;
		var branch = value.branch;
		
		await openPlatformSelectionMenu(body.view.id, context.botToken, user, branch, body.user.id);
	},

	onCreateBuildClick: async function(ack, body, context, platform)
	{
		var value = JSON.parse(body.actions[0].value);
		
		var user = value.user;
		var branch = value.branch;

		openLoadingMenu(body, context, "Starting building! ");

		await StartBuild(user, branch, platform, body.user.id);
		await reOpenStartMenu(body.view.id, context.botToken, true, body.user.id);
	},

	onCancelBuildClick: async function(ack, body, context)
	{
		var value = JSON.parse(body.actions[0].value);
	 	var state = JSON.parse(body.view.private_metadata);

		await openLoadingMenu(body, context, "Removing build ");
		await CancelBuild(value.build);
		await reloadView(state);
	},

	onOpenArchiveClick: async function(ack, body, context)
	{
		await openBuildsArchiveMenu(body.trigger_id, context.botToken, body.user.id);
		//await openBuildsArchiveMenu(body.view.id, context.botToken, body.user.id);
	},

	onBackClick: async function(ack, body, context)
	{
		await reOpenStartMenu(body.view.id, context.botToken, false, body.user.id);
	},

	reloadView: reloadView
  //   controller.hears('sample','message,direct_message', async(bot, message) => {
  //       await bot.reply(message, 'I heard a sample message.');
  //   });

  //   controller.on('message,direct_message', async(bot, message) => 
  //   {
  //   	console.log("click");
		// if (message.actions.length > 0)
		// {
		// 	if (message.actions[0].type == 'users_select') 
		// 	{
		// 		await onUserSelected(bot, message);
		// 	}
		// 	else if (message.actions[0].type == 'static_select')
		// 	{
		// 		await onBranchSelected(bot, message);
		// 	}
		// 	else if (message.actions[0].type == "button")
		// 	{
		// 		await onButtonSelected(bot, message);
		// 	}
		// }
  //   });
}

async function reloadView(state)
{
	var stateValues = state.values;

	if (state.loading == true)
	{
		return;
	}

	try
	{
		if (stateValues.menu == "start")
		{
			await reOpenStartMenu(state.viewId, state.token, false, state.user);
		}
		else if (stateValues.menu == "branchSelection")
		{
			await openBranchSelectionMenu(state.viewId, state.token, stateValues.user, state.user);
		}
		else if (stateValues.menu == "platformSelection")
		{
			await openPlatformSelectionMenu(state.viewId, state.token, stateValues.user, stateValues.branch, state.user);
		}
	}
	catch(error)
	{

	}
}

function getBuildsArchiveTopBlocks()
{
	var blocks = [];

	var block = {
		"type": "section",
		"text": {
			"type": "mrkdwn",
			"text": "*Builds Archive*"
		},
		"accessory" :
	 	{
			"type": "button",
			"text": {
				"type": "plain_text",
				"text": "Builds Archive"
			},
			"value": "asd",
			"action_id": "builds_archive",
			"style": "primary"
		}
	}

	blocks.push(block);

	return blocks;
}

function getBackButtonBlocks()
{
	var blocks = [];

	var block = 
		{
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Back",
						"emoji": true
					},
					"style": "primary",
					"value": "click_me_123",
					"action_id": "back"
				}
			]
		}
	

	blocks.push(block);

	return blocks;
}


function getDivider()
{
	var block = 
		{
			"type": "divider"
		};
	return block;
}

function getBuildSmallValue(buildToConvert)
{
	var value = {
		projectId: buildToConvert.projectId,
		buildtargetid : buildToConvert.buildtargetid,
		build : buildToConvert.build,
		buildStartTime : buildToConvert.buildStartTime
	}

	return value;
}

function getRuningBuildLine(index, build)
{
	var block = {
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": index + ". *:" + build.platform + ": " + build.scmBranch + "* build *#" + 
				build.build + "* is running for *" + getMinutesRunningForBuild(build) + " min*"
			},
			"accessory": {
				"type": "button",
				"text": {
					"type": "plain_text",
					"text": "Cancel"
				},
				"value": JSON.stringify({ value : "cancel_build",
							build : getBuildSmallValue(build)
						}),
				"action_id": "button",
				"style": "danger"
			}
		};

	return block;
}

function getQueuedBuildLine(index, build)
{
	var block = {
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": index + ". *:" + build.platform + ": " + build.scmBranch + "* build *#" + 
				build.build + "* is in queue"
			},
			"accessory": {
				"type": "button",
				"text": {
					"type": "plain_text",
					"text": "Remove"
				},
				"value": JSON.stringify({ value : "cancel_build",
							build : getBuildSmallValue(build)
						}),
				"action_id": "button",
				"style": "danger"
			}
		};

	return block;
}

function getTextSection(text)
{
	var block = {
		"type": "section",
		"text": {
			"type": "mrkdwn",
			"text": text
		}
	};

	return block;
}

function getBuildStatusButtons()
{
	var block = {
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Add new build",
						"emoji": true
					},
					"action_id": "add_new_build",
					"value": "asd",
					"style": "primary"
				},
                getQuitButton()
			]
		};

	return block;
}

function getQuitButton()
{
	var block = {
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Quit",
						"emoji": true
					},
					"value": "cancel",
					"style": "danger"
		};

	return 	block;
}
function getRunningBuildsBlock(runningBuilds)
{
	var blocks = [];

	blocks.push(getTextSection("*Running: *"));
	
	if (runningBuilds.length == 0)
	{
		blocks.push(getTextSection("1. Build slot is available"));
		blocks.push(getTextSection("2. Build slot is available"));
	}

	var counter = 0;
	for(var i = runningBuilds.length - 1; i >= 0; i--)
	{
		counter++;
		blocks.push(getRuningBuildLine(counter, runningBuilds[i]));
	}

	if (runningBuilds.length == 1)
	{
		blocks.push(getTextSection("2. Build slot is available"));
	}

	return blocks;
}

function getQueuedBuildsBlock(runningBuilds, queuedBuilds)
{
	var blocks = [];

	blocks.push(getTextSection("*Queued: *"));
	
	if (queuedBuilds.length == 0)
	{
		blocks.push(getTextSection("The queue is empty"));
	}

	var counter = runningBuilds.length;
	for(var i = queuedBuilds.length - 1; i >= 0; i--)
	{
		counter++;
		blocks.push(getQueuedBuildLine(counter, queuedBuilds[i]));
	}

	return blocks;
}

function getBuildStatusBlocksWithBuilds(runningBuilds, queuedBuilds)
{
	var blocks = [];

	blocks.push(getDivider());
	blocks = blocks.concat(getBuildsArchiveTopBlocks());
	blocks.push(getDivider());
	blocks = blocks.concat(getRunningBuildsBlock(runningBuilds));
	blocks.push(getDivider());
	blocks = blocks.concat(getQueuedBuildsBlock(runningBuilds, queuedBuilds));
   	blocks.push(getDivider());
	
	return blocks;
}

function getUserSelectionBlocks()
{
    var blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*Please select a user*:"
            }
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "users_select",
                    "action_id": "user_selected",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select a user",
                        "emoji": true
                    }
                }
            ]
        }
    ];

    return blocks;
}


async function getBuildStatusBlocks()
{
   	var runningBuilds = await GetRunningBuilds();
   	var queuedBuilds = await GetQueuedBuilds();

   	return getBuildStatusBlocksWithBuilds(runningBuilds, queuedBuilds);
}

async function GetSelectBranchesBlock(user)
{
	url = GetRepoURL(user);

	if (url != null)
	{
		const branchesResponse = await fetch(url, {});
		const branches = await branchesResponse.json();

		if (branches.message)
		{
			error = branches.message;
		}
		return FormBranchesBlocks(branches, user);

		// LogBranches(branches);
	}
	else
	{
		error = "user doesn't have any games";
		return [];
	}

}



async function onButtonSelected(bot, message)
{
	if (message.actions[0].value == "cancel")
	{
		bot.replyInteractive(message, "Bye bye!");
	}
	else if (message.actions[0].value == "addNewBuild")
	{
		await userSelectionMenu(bot, message);
	}
	else
	{
		var state = JSON.parse(message.actions[0].value);

		if (state.value == "cancel_build")
		{
			await CancelBuild(state.build);
			await startMenu(bot, message);
		}
		else
		{
			const result = await UpdateBuildTarget(bot, message, state);	
		}
		
	}
}

function GetRepoURL(user)
{
	var gitlabRepos = {};
	gitlabRepos['U4KSJ2RJ8'] = "14042156"; //terko
	gitlabRepos['U58MWTQ1J'] = "14042181"; //@oz
	gitlabRepos['U585UFVM3'] = "14042186"; //@naz0r
	gitlabRepos['U7N52PR6X'] = "14042138"; //@Oleksandr Orchakov 
	gitlabRepos['U7LJKNF96'] = "14042203"; //@Max Karpinsky 
	gitlabRepos['UC94FSJ4V'] = "14042172"; //@purplebread 
	gitlabRepos['U59UF4SF8'] = "14042193"; //@bromm
	gitlabRepos['UC1N5KQ4F'] = null; //@romko
	gitlabRepos['U6BNEMWKD'] = "14042762"; //@Maryan Tytyunnuk
	gitlabRepos['U9Z1M4TKK'] = null; //@Alexandr Doroshenko
	
	return 'https://gitlab.com/api/v4/projects/' + gitlabRepos[user] + '/repository/branches?private_token=jdtk93Az_2x3XupkrkH_';
}

function FormBranchesBlocks(branches, user)
{
	var blocks = [
					{
						"type": "section",
						"text": {
							"type": "mrkdwn",
							"text": "Please, select a *branch:*"
						}
					},
					{
						"type": "actions",
						"elements": [
							{
								"type": "static_select",
								"action_id": "branch_selected",
								"placeholder": {
									"type": "plain_text",
									"text": "Select a branch",
									"emoji": true
								},
								"options": [
								]
							}
						]
					}
				];


	for(var i = 0; i < branches.length; i++)
  	{
  		blocks[1].elements[0].options.push(addBranchOption(branches[i].name, user));
  	}

  	return blocks;
}

function addBranchOption(branch, user)
{
	return {
								"text": {
									"type": "plain_text",
									"text": branch,
									"emoji": true
								},
								"value": JSON.stringify({"branch" : branch, "user" : user})
							};
}



function GetCloudBuildProjectName(user)
{
	var projectsMap = {};
	projectsMap['U4KSJ2RJ8'] = "prototypes-oles"; //terko
	projectsMap['U58MWTQ1J'] = "prototypes-ostap"; //@oz
	projectsMap['U585UFVM3'] = "prototypes-nazar"; //@naz0r
	projectsMap['U7N52PR6X'] = "prototypes-sanya"; //@Oleksandr Orchakov 
	projectsMap['U7LJKNF96'] = "prototypes-max"; //@Max Karpinsky 
	projectsMap['UC94FSJ4V'] = "prototypes-adriyan"; //@purplebread 
	projectsMap['U59UF4SF8'] = "prototypes-borys"; //@bromm
	projectsMap['UC1N5KQ4F'] = "prototypes-romko"; //@romko
	projectsMap['U6BNEMWKD'] = "prototypes-maryan"; //@Maryan Tytyunnuk
	projectsMap['U9Z1M4TKK'] = "prototypes-sasha"; //@Alexandr Doroshenko
	
	return projectsMap[user];
}

function GetCloudBuildTargetURL(user, platform)
{
	return  'https://build-api.cloud.unity3d.com/api/v1/orgs/terko/projects/' + GetCloudBuildProjectName(user) + "/buildtargets/" + platform;
}

function GetStartBuildURL(user, platform)
{
	return 'https://build-api.cloud.unity3d.com/api/v1/orgs/terko/projects/' + GetCloudBuildProjectName(user) + "/buildtargets/" + platform + "/builds";
}

function ListAllBuildsThatAreRunningURL()
{
	return 'https://build-api.cloud.unity3d.com/api/v1/orgs/terko/builds?buildStatus=started';
}

function ListAllBuildsThatAreQueuedURL()
{
	return 'https://build-api.cloud.unity3d.com/api/v1/orgs/terko/builds?buildStatus=queued';
}

function ListAllBuildsThatAreSentToBuilderURL()
{
	return 'https://build-api.cloud.unity3d.com/api/v1/orgs/terko/builds?buildStatus=sentToBuilder';
}

function GetCancelBuildURL(project, buildtargetid, build)
{
	return "https://build-api.cloud.unity3d.com/api/v1/orgs/terko/projects/" + project + "/buildtargets/" + buildtargetid + "/builds/" + build;
}

function FilterSameBranchAndPlatformForBuilds(builds, branch, platform)
{
	var sameRunningBuilds = [];

	for (var i = 0; i < builds.length; i++)
	{
		if (builds[i].scmBranch == branch && builds[i].platform == platform)
		{
			var build = {};
			build.build = builds[i].build;
			build.projectId = builds[i].projectId;
			build.buildtargetid = builds[i].buildtargetid;
			build.buildStartTime = builds[i].buildStartTime;
			sameRunningBuilds.push(build);
		}
	}
	return sameRunningBuilds;
}

async function GetRunningBuilds()
{
	var runningBuildsResponse = await fetch(ListAllBuildsThatAreRunningURL(), { method: 'GET', headers: headers});
	var runningBuilds = await runningBuildsResponse.json();

	return runningBuilds;
}

async function GetQueuedBuilds()
{
	var queuedBuildsResponse = await fetch(ListAllBuildsThatAreQueuedURL(), { method: 'GET', headers: headers});
	var queuedBuilds = await queuedBuildsResponse.json();
	
	var sendToBuilderBuildsResponse = await fetch(ListAllBuildsThatAreSentToBuilderURL(), { method: 'GET', headers: headers});
	var sendToBuilderBuilds = await sendToBuilderBuildsResponse.json();

	queuedBuilds = queuedBuilds.concat(sendToBuilderBuilds);

	return queuedBuilds;
}

function CheckIfPlatformIsAlreadyInQueue(branch, platform, queuedBuilds)
{
	var sameQueuedBuilds = FilterSameBranchAndPlatformForBuilds(queuedBuilds, branch, platform);

	return sameQueuedBuilds.length > 0;
}

function GetSameRunningBuilds(branch, platform, runningBuilds)
{
	var sameRunningBuilds = FilterSameBranchAndPlatformForBuilds(runningBuilds, branch, platform);

	return sameRunningBuilds;
}

function getMinutesRunningForBuild(build)
{
	var unixTimeZero = Date.parse(build.buildStartTime);
	var dateNow = new Date();
	minutes = Math.ceil(((dateNow - unixTimeZero)/1000)/60);	

	if (Number.isNaN(minutes))
	{
		minutes = 0;
	}

	return minutes;
}

function GetRunningTimeForPlatfom(branch, platform, runningBuilds)
{
	var sameRunningBuilds = GetSameRunningBuilds(branch, platform, runningBuilds);
	var minutes = 0;
	if (sameRunningBuilds.length > 0)
	{
		minutes = getMinutesRunningForBuild(sameRunningBuilds[0]);
	}
	
	return {isRunning : sameRunningBuilds.length > 0, time : minutes};
}

async function CancelRunningBuilds(branch, platform, runningBuilds)
{
	var runningBuilds = GetRunningBuilds();

	var sameRunningBuilds = GetSameRunningBuilds(branch, platform, runningBuilds);

	for(var i = 0; i < sameRunningBuilds.length; i++)
	{
		await CancelBuild(sameRunningBuilds[i]);
	}
}

async function CancelBuild(build)
{
	await fetch(GetCancelBuildURL(build.projectId, build.buildtargetid, build.build), { method: 'DELETE', headers: headers});
}

async function TryRunningBuild(user, branch, platform, launchUser)
{
	//await CancelRunningBuilds(branch, platform);

	//var displayName = await getDisplayName(process.env.botToken, message.user);
}

async function StartBuild(user, branch, platform, launchUser)
{
	if (platform == "both")
	{
		await InitiateBuild(user, branch, "ios", launchUser);

		await InitiateBuild(user, branch, "android", launchUser);
	}
	else
	{
		await InitiateBuild(user, branch, platform, launchUser);	
	}
}

async function getDisplayName(token, user)
{
	var res = await fetch(getUserURL(token, user), {
      method: 'get'
    });

    var resJson = await res.json();
		
    return resJson.user.profile.display_name;
}

function getUserURL(token, user)
{
	return "https://slack.com/api/users.info?token=" + token + "&user=" + user;
}

async function InitiateBuild(user, branch, platform, launchUser)
{
	var body = {};
	body.settings = {};
	body.settings.scm = {};
	body.settings.scm.branch = branch;
	body.settings.platform = {};

	var postfix = 1;

	postfix = Math.floor(Date.now() / 1000);
	
	var extendedBuildInfo = 
	{
		user : launchUser,
		branch : branch
	}

	var bundleIdCompanyName = "501";
	if (platform == "android")
	{
		bundleIdCompanyName = "studio501";
	}

	db.pendingRunners[GetCloudBuildProjectName(user) + platform] = extendedBuildInfo;

	body.settings.platform.bundleId = "com." + bundleIdCompanyName + "." + branch.replace(/[^a-zA-Z ]/g, "") + postfix;

	var resp = await fetch(GetCloudBuildTargetURL(user, platform), { method: 'PUT', headers: headers, body:  JSON.stringify(body)});
	
	var startBuildResponse = await fetch(GetStartBuildURL(user, platform), { method: 'POST', headers: headers});
	
	buildsResponse = fetch(GetStartBuildURL(user, platform), { method: 'GET', headers: headers})
      .then(buildsResponse => 
      {
		buildsResponse.json().then(builds =>
		{
			var buildNumber = -1;

			if (builds.length > 0)
			{
				buildNumber = builds[0].build;
			}

			db.updateRunner(GetCloudBuildProjectName(user), platform, branch, buildNumber, launchUser);
		      
		 }
			);
		
		}
      	);


	
}

function getPlatformButtonText(branch, platform, readablePlatform, builds)
{
	var isInQueue = CheckIfPlatformIsAlreadyInQueue(branch, platform, builds.queued);
	var runState = GetRunningTimeForPlatfom(branch, platform, builds.running);

	var buttonText = readablePlatform + ":" + readablePlatform + ":";

	if (isInQueue == true)
	{
		buttonText = readablePlatform + ":" + readablePlatform + ": (Already queued)";
	}
	if (runState.isRunning == true)
	{
		buttonText = readablePlatform + ":" + readablePlatform + ": (Started " + runState.time + "min ago)";
	}

	return buttonText;
}

function GetPlatformSelectionBlocks(user, branch, builds)
{
	var iosButtonText =  getPlatformButtonText(branch, "ios", "iOS", builds);
	var androidButtonText =  getPlatformButtonText(branch, "android", "Android", builds);

	var iosValue = {};
	iosValue.user = user;
	iosValue.branch = branch;
	iosValue.platform = "ios";

	var androidValue = {};
	androidValue.user = user;
	androidValue.branch = branch;
	androidValue.platform = "android";
	
	var bothValue = {};
	bothValue.user = user;
	bothValue.branch = branch;
	bothValue.platform = "both";
	var blocks = [];

	blocks.push(getTextSection("*" + branch + ": *"));
	blocks = blocks.concat([
					{
						"type": "actions",
						"elements": [
							{
								"type": "button",
								"text": {
									"type": "plain_text",
									"emoji": true,
									"text": iosButtonText
								},
								"action_id": "create_build_ios",
								"style": "primary",
								"value": JSON.stringify(iosValue)
							},
							{
								"type": "button",
								"text": {
									"type": "plain_text",
									"emoji": true,
									"text": androidButtonText
								},
								"action_id": "create_build_android",
								"style": "primary",
								"value": JSON.stringify(androidValue)
							},
							{
								"type": "button",
								"text": {
									"type": "plain_text",
									"emoji": true,
									"text": "Both :ios:/:android:"
								},
								"action_id": "create_build_both",
								"style": "primary",
								"value": JSON.stringify(bothValue)
							}
						]
					}
				]);

	return blocks;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ReplyInteractiveBlocks(bot, message, blocksArray)
{
	var blocksToSend = 
	{
		blocks : blocksArray
	};
	blocksToSend = JSON.stringify(blocksToSend);
	blocksToSend = JSON.parse(blocksToSend);
	
	await bot.replyInteractive(message, 
		{
			blocks: blocksArray

		});
}

async function openPlatformSelectionMenu(viewId, token, user, branch, runningUser)
{   	
	var runningBuilds = await GetRunningBuilds();
   	var queuedBuilds = await GetQueuedBuilds();

   	var builds = 
   	{
   		running : runningBuilds,
   		queued : queuedBuilds
   	};

   	var buildStatusBlocks = getBuildStatusBlocksWithBuilds(runningBuilds, queuedBuilds);
	
   	blocks = buildStatusBlocks.concat(GetPlatformSelectionBlocks(user, branch, builds));
   	
   	var block = {blocks: blocks}

	var state = { values : {menu : "platformSelection", user : user, branch : branch, buildStatusBlocks: buildStatusBlocks}};
	state.user = runningUser;
	state.loading = false;

   	await updateMenu(viewId, token, block, state);
}

async function openLoadingMenu(body, context, text)
{ 
	var stateValues = JSON.parse(body.view.private_metadata).values;

	var blocks = stateValues.buildStatusBlocks;
	
   	blocks.push(getTextSection(text + ":loading_wheel:"));
   	
   	var block = {blocks: blocks}

	var state = body.view.private_metadata;
	//state.user = runningUser;
	state.loading = true;

   	await updateMenu(body.view.id, context.botToken, block, state);
}

async function openBranchSelectionMenu(viewId, token, user, runningUser)
{
   	var buildStatusBlocks = await getBuildStatusBlocks();
	
   	blocks = buildStatusBlocks.concat(await GetSelectBranchesBlock(user));
   	
   	var block = {blocks: blocks}

	var state = { values : {menu : "branchSelection", user : user, buildStatusBlocks: buildStatusBlocks}};
	state.user = runningUser;
	state.loading = false;
	
   	await updateMenu(viewId, token, block, state);
}

function capitalize(str) 
{
    str = str.split(" ");

    for (var i = 0, x = str.length; i < x; i++) {
        str[i] = str[i][0].toUpperCase() + str[i].substr(1);
    }

    return str.join(" ");
}

function convertTimeStampToDate(ts)
{
	if (ts == null)
	{
		return "";
	}

	var date = new Date(ts);
	var months_arr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 	var day = date.getDate();
 	var year = date.getFullYear();
 	var month = months_arr[date.getMonth()];

 	return day + '/' + month + '/' + year;
}

async function getBuildsArchiveBlocks()
{
	var builds = await db.getBuilds();

	var blocks = [];

	for(var i = 0; i < builds.length; i++)
	{
		var build = builds[i];

		var name = build.branch;

		name = name.replace(/-/g, ' ');
		name = capitalize(name);

		var icon = build.iconUrl;

		var iosBuild =  build.iosBuild;
		var iosBuildTime = convertTimeStampToDate(build.iosTimeStamp);
		var iosDownloadUrl = build.iosDownloadUrl;
		var iosInstallUrl = build.iosShareUrl;

		var androidBuild =  build.androidBuild;
		var androidBuildTime = convertTimeStampToDate(build.androidTimeStamp);
		var androidDownloadUrl = build.androidDownloadUrl;
		var androidInstallUrl = build.androidShareUrl;

		blocks = blocks.concat(getBuildLine(icon, name, 
					 iosBuild,
					 iosBuildTime,
				     androidBuild,
				     androidBuildTime,
					 iosDownloadUrl, iosInstallUrl, 
					 androidDownloadUrl, androidInstallUrl));

		blocks.push(getDivider());
	}

	if (builds.length == 0)
	{
		builds.push(getTextSection("Empty"));
	}

	return blocks;
}

function getDownloadButton(text, url)
{
	return {
			"type": "button",
			"text": {
				"type": "plain_text",
				"text": text,
				"emoji": true
			},
			"value": "click_me_123",
			"style": "primary",
			"url": url	
	}	
}

function getBuildLine(icon, name, 
					 iosBuild,
					 iosBuildTime,
				     androidBuild,
				     androidBuildTime,
					 iosDownloadUrl, iosInstallUrl, 
					 androidDownloadUrl, androidInstallUrl)
{

	var iosText = ":ios:" + " [" + iosBuildTime +  "]: " + " *build " + iosBuild + "* " +
				  "<" + iosInstallUrl + "|Install>" + "\n\n";
				  // "<" + iosDownloadUrl + "|Download .ipa>" + "\n\n";

	var androidText =  ":android:" + " [" + androidBuildTime +  "]: " + " *build " + androidBuild + "* " +
				 "<" + androidInstallUrl + "|Install>"; //+ 
				 // "<" + androidDownloadUrl + "|Download .apk>";

	if (iosBuild == null)
	{
		iosText = "";
	}
	if (androidBuild == null)
	{
		androidText = "";
	}

	var blocks = [
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "*" + name + "*\n\n" +
				 iosText +
				androidText
			},
			"accessory": {
				"type": "image",
				"image_url": icon,
				"alt_text": "alt text for image"
			}
		}
		// {
		// 	"type": "actions",
		// 	"elements": [
				
		// 	]
		// }
    ];

    // if (iosBuild != null)
    // {
    // 	blocks[1].elements.push(getDownloadButton("Install :ios:", iosDownloadUrl));
    // 	blocks[1].elements.push(getDownloadButton("Download :ios:", iosInstallUrl));
    // }
    // if (androidBuild != null)
    // {
    // 	blocks[1].elements.push(getDownloadButton("Install :android:", androidDownloadUrl));
    // 	blocks[1].elements.push(getDownloadButton("Download :android:", androidInstallUrl));
    // }
	return blocks;
}

async function openBuildsArchiveMenu(viewId, token, runningUser)
{
	var blocks = [];
   	
	blocks = blocks.concat(await getBuildsArchiveBlocks());

	// blocks = blocks.concat(getBackButtonBlocks());

   	var block = {blocks: blocks}

	var state = { values : {menu : "buildsArchive", buildStatusBlocks: null}};
	state.user = runningUser;

   	await pushMenu(viewId, token, block, state);
}

async function reOpenStartMenu(viewId, token, showSuccess, runningUser)
{
	var blocks = [];
   	var buildStatusBlocks = await getBuildStatusBlocks();
   	blocks = blocks.concat(buildStatusBlocks);

   	if (showSuccess == true)
	{
		blocks.push(getTextSection("Success! :check:"));
	}

	blocks = blocks.concat(getUserSelectionBlocks());

   	var block = {blocks: blocks}

	var state = { values : {menu : "start", buildStatusBlocks: buildStatusBlocks}};
	state.user = runningUser;

   	await updateMenu(viewId, token, block, state);
}

async function openStartMenu(payload, context)
{
   	var buildStatusBlocks = await getBuildStatusBlocks();

	blocks = buildStatusBlocks.concat(getUserSelectionBlocks());

   	var block = {blocks: blocks}

	var state = { values : {menu : "start", buildStatusBlocks: buildStatusBlocks}};
	
	state.user = payload.user_id;
	state.loading = false;

   	await openMenu(payload.trigger_id, context.botToken, block, state);
}

function createViewFromBlock(block, cancelText, titleText)
{
	var defaultTitle = "Prototypes Builder";

	if (titleText != null)
	{
		defaultTitle = titleText;
	}

	var title =  {
            "type": "plain_text",
            "text": defaultTitle,
            "emoji": true
        };

    var submit = {
                "type": "plain_text",
                "text": "Submit",
                "emoji": true
            };

    var close = {
                "type": "plain_text",
                "text": cancelText,
                "emoji": true
            };

	block.type = "modal";
	block.title = title;
	block.close = close;
	// block.submit = submit;

	return block;
}

async function pushMenu(trigger_id, token, block, state)
{
	var view = createViewFromBlock(block, "Back", "Builds Archive");
	
    var res = await app.client.views.push({
	    token: token,
	    trigger_id: trigger_id,
	    view: view
  	});
}

async function updateMenu(viewId, token, block, state)
{
	var view = createViewFromBlock(block, "Quit");
	
	state.viewId = viewId;
  	state.token = token;

  	if (state.user != null)
  	{
  		db.updateState(state.user, state);	
  	}
	

	view.private_metadata = JSON.stringify(state);
	
    var res = await app.client.views.update({
	    token: token,
	    view_id: viewId,
	    view: view
  	});
}

async function openMenu(trigger_id, token, block, state)
{
	var view =  createViewFromBlock(block, "Quit");
	view.private_metadata = JSON.stringify(state);

    var res = await app.client.views.open({
	    trigger_id: trigger_id,
	    token: token,
	    view: view
  	});
  	state.viewId = res.view.id;
  	state.token = token;
	db.updateState(state.user, state);
}

