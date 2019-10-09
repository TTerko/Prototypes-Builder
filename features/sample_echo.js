/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

const request = require("request");
const fetch = require('node-fetch');	
const { WebClient } = require('@slack/web-api');
const web = new WebClient(process.env.botToken);

slackHeaders = { 'Content-type' : 'application/json' ,
		'Authorization': 'Bearer xoxb-155157046448-778754667713-JrVbKjyS8mFMGxmZ1hCToLs2'};

var botFile = require('../bot.js');

headers = { "Content-type" : "application/json",
	'Authorization': 'Basic b182563c74cc832f104816a9ecdeee15'};

function getBuildStatusTopBlock(runningBuilds)
{
	var block = {
		"type": "section",
		"text": {
			"type": "mrkdwn",
			"text": "*Build Status*"
		}
	}
	if (runningBuilds.length > 0)
	{
		block.accessory =
		 {
			"type": "button",
			"text": {
				"type": "plain_text",
				"text": "Cancel All Builds"
			},
			"value": JSON.stringify({ value : "cancel_build",
							build : "_all"
						}),
			"action_id": "button",
			"style": "danger"
		}
	}
	return block;
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
					"value": "addNewBuild",
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

	for(var i = 0; i < runningBuilds.length; i++)
	{
		blocks.push(getRuningBuildLine(i + 1, runningBuilds[i]));
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

	for(var i = 0; i < queuedBuilds.length; i++)
	{
		blocks.push(getQueuedBuildLine(runningBuilds.length + i + 1, queuedBuilds[i]));
	}

	return blocks;
}

async function getBlocksWithBuildStatus(blocks)
{
   	var runningBuilds = await GetRunningBuilds();
   	var queuedBuilds = await GetQueuedBuilds();

	blocks = getBuildStatusBlocks(runningBuilds, queuedBuilds).concat(blocks);

	return blocks;
}

async function selectUser(bot, message, runningBuilds, queuedBuilds)
{
	var block = {
            blocks: [
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
                            "placeholder": {
                                "type": "plain_text",
                                "text": "Select a user",
                                "emoji": true
                            }
                        },
		                getQuitButton()
                    ]
                },
            ]
        } ; 

  	block.blocks = getBuildStatusBlocks(runningBuilds, queuedBuilds).concat(block.blocks);
	console.log(block);
    await bot.replyInteractive(message, block);
}

function getBuildStatusBlocks(runningBuilds, queuedBuilds)
{
	var blocks = [];
	// blocks.push(getDivider());
	// blocks.push(getBuildStatusTopBlock(runningBuilds));

	blocks.push(getDivider());
	blocks = blocks.concat(getRunningBuildsBlock(runningBuilds));
	blocks.push(getDivider());
	blocks = blocks.concat(getQueuedBuildsBlock(runningBuilds, queuedBuilds));
   	blocks.push(getDivider());
	
	
	return blocks;
}

async function onUserSelected(bot, message)
{
	var user = message.actions[0].selected_user;
	url = GetRepoURL(user);

	var error = null;

	if (url != null)
	{
		const branchesResponse = await fetch(url, {});
		const branches = await branchesResponse.json();

		if (branches.message)
		{
			error = branches.message;
		}
		await bot.replyInteractive(message, await GetBranchesBlocks(branches, user));
		// LogBranches(branches);
	}
	else
	{
		error = "user doesn't have any games";
	}

	if (error)
	{
		await bot.replyInteractive(message, error);
	}
}

async function onBranchSelected(bot, message)
{
	var error = null;
	var value =  JSON.parse(message.actions[0].selected_option.value);

	var user = value.user;
	var branch = value.branch;

	const result = await SelectPlatform(bot, message, user, branch);

	// await bot.replyEphemeral(message, result);
	
	if (error)
	{
		await bot.replyInteractive(message, error);
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

async function GetBranchesBlocks(branches, user)
{
	var blocks = 
	{
		"blocks": [
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
					"placeholder": {
						"type": "plain_text",
						"text": "Select an item",
						"emoji": true
					},
					"options": [
					]
				},
				getQuitButton()
			]
		}
		]	
	}	

	for(var i = 0; i < branches.length; i++)
  	{
  		blocks.blocks[1].elements[0].options.push(addBranchOption(branches[i].name, user));
  	}

  	blocks.blocks = await getBlocksWithBuildStatus(blocks.blocks);

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

async function CheckIfPlatformIsAlreadyInQueue(bot, message, branch, platform)
{
	queuedBuilds = await GetQueuedBuilds();

	var sameQueuedBuilds = FilterSameBranchAndPlatformForBuilds(queuedBuilds, branch, platform);

	return sameQueuedBuilds.length > 0;
}

async function GetSameRunningBuilds(bot, message, branch, platform)
{
	var runningBuilds = await GetRunningBuilds();

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

async function GetRunningTimeForPlatfom(bot, message, branch, platform)
{
	var sameRunningBuilds = await GetSameRunningBuilds(bot, message, branch, platform);
	var minutes = 0;
	if (sameRunningBuilds.length > 0)
	{
		minutes = getMinutesRunningForBuild(sameRunningBuilds[0]);
	}
	
	return {isRunning : sameRunningBuilds.length > 0, time : minutes};
}

async function CancelRunningBuilds(bot, message, branch, platform)
{
	var sameRunningBuilds = await GetSameRunningBuilds(bot, message, branch, platform);

	for(var i = 0; i < sameRunningBuilds.length; i++)
	{
		await CancelBuild(sameRunningBuilds[i]);
	}
}

async function CancelBuild(build)
{
	await fetch(GetCancelBuildURL(build.projectId, build.buildtargetid, build.build), { method: 'DELETE', headers: headers});
}

async function TryRunningBuild(bot, message, user, branch, platform)
{
	await CancelRunningBuilds(bot, message, branch, platform);

	//var displayName = await getDisplayName(process.env.botToken, message.user);

	botFile.buildUserCache[branch + platform] = message.user;

	await InitiateBuild(bot, message, user, branch, platform);	
}

async function UpdateBuildTarget(bot, message, state)
{
	var user = state.user;
	var branch = state.branch;
	var platform = state.platform;

	if (platform == "both")
	{
		state.platform = "ios";
		await TryRunningBuild(bot, message, user, branch, state.platform);

		state.platform = "android";
		await TryRunningBuild(bot, message, user, branch, state.platform);
	}
	else
	{
		await TryRunningBuild(bot, message, user, branch, platform);	
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

async function InitiateBuild(bot, message, user, branch, platform)
{
	var body = {};
	body.settings = {};
	body.settings.scm = {};
	body.settings.scm.branch = branch;
	body.settings.platform = {};

	const buildsResponse = await fetch(GetStartBuildURL(user, platform), { method: 'GET', headers: headers});

	const builds = await buildsResponse.json();
	var postfix = 1;

	if (builds.length > 0)
	{
		postfix = builds[0].build + 1;
	}

	var bundleIdCompanyName = "501";
	if (platform == "android")
	{
		bundleIdCompanyName = "studio501";
	}

	body.settings.platform.bundleId = "com." + bundleIdCompanyName + "." + branch.replace(/[^a-zA-Z ]/g, "")+ postfix;

	await fetch(GetCloudBuildTargetURL(user, platform), { method: 'PUT', headers: headers, body:  JSON.stringify(body)});

	console.log(GetStartBuildURL(user, platform));

	await fetch(GetStartBuildURL(user, platform), { method: 'POST', headers: headers});


	//await bot.replyInteractive(message, "*[" + platform + "] (" + branch + ")* build is initiated");	
	await startMenu(bot, message);	
}

async function getPlatformButtonText(bot, message, branch, platform, readablePlatform)
{
	var isInQueue = await CheckIfPlatformIsAlreadyInQueue(bot, message, branch, platform);
	var runState = await GetRunningTimeForPlatfom(bot, message, branch, platform);
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

async function GetPlatformSelectionBlocks(bot, message, user, branch)
{
	var iosButtonText = await getPlatformButtonText(bot, message, branch, "ios", "iOS");
	var androidButtonText = await getPlatformButtonText(bot, message, branch, "android", "Android");

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

	return {blocks: [
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
				"style": "primary",
				"value": JSON.stringify(bothValue)
			},
			getQuitButton()
		]
	}
]};
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function SelectPlatform(bot, message, user, branch)
{
	var block = await GetPlatformSelectionBlocks(bot, message, user, branch);

	block.blocks = await getBlocksWithBuildStatus(block.blocks);

	await bot.replyInteractive(message, block);
}

async function ReplyInteractiveBlocks(bot, message, blocksArray)
{
	var blocksToSend = 
	{
		blocks : blocksArray
	};
	blocksToSend = JSON.stringify(blocksToSend);
	blocksToSend = JSON.parse(blocksToSend);
	console.log(blocksToSend);
	await bot.replyInteractive(message, 
		{
			blocks: blocksArray

		});
}

async function userSelectionMenu(bot, message)
{
   	var runningBuilds = await GetRunningBuilds();
   	var queuedBuilds = await GetQueuedBuilds();

	await selectUser(bot, message, runningBuilds, queuedBuilds);
}

async function startMenu(bot, message)
{
	var runningBuilds = await GetRunningBuilds();
   	var queuedBuilds = await GetQueuedBuilds();

   	var blocks =  getBuildStatusBlocks(runningBuilds, queuedBuilds);

	blocks = blocks.concat(getBuildStatusButtons());

   	var block = {blocks: blocks}

   	await showMenu(bot, message, block);
	// await bot.replyInteractive(message, block);
}

async function showMenu(bot, message, block)
{
	var title =  {
                "type": "plain_text",
                "text": "Prototypes Builder",
                "emoji": true
            };

    var submit = {
                "type": "plain_text",
                "text": "Submit",
                "emoji": true
            };

    var close = {
                "type": "plain_text",
                "text": "Cancel",
                "emoji": true
            };

	block.type = "modal";
	block.title = title;
	// block.submit = submit;
	block.close = close;


    var res = await web.views.open({
	    trigger_id: message.trigger_id,
	    view: block
  	});

   // var res = await fetch("https://api.slack.com/methods/dialog.open", req);
     console.log(res);

	//await bot.replyWithDialog(bot, message, block);
}

module.exports = function(controller) {

	controller.on('slash_command', async(bot, message) => {
	   await startMenu(bot, message);

	   	//await ReplyInteractiveBlocks(bot, message, blocks);
	    // 
	});

    controller.hears('sample','message,direct_message', async(bot, message) => {
        await bot.reply(message, 'I heard a sample message.');
    });

    controller.on('message,direct_message', async(bot, message) => 
    {
    	console.log("click");
		if (message.actions.length > 0)
		{
			if (message.actions[0].type == 'users_select') 
			{
				await onUserSelected(bot, message);
			}
			else if (message.actions[0].type == 'static_select')
			{
				await onBranchSelected(bot, message);
			}
			else if (message.actions[0].type == "button")
			{
				await onButtonSelected(bot, message);
			}
		}
    });

}


