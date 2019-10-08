/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

const request = require("request");
const fetch = require('node-fetch');	
var botFile = require('../bot.js');

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
		await bot.replyInteractive(message, GetBranchesBlocks(branches, user));
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
		// bot.deleteMessage(message);
	}
	else
	{
		var state = JSON.parse(message.actions[0].value);

		const result = await UpdateBuildTarget(bot, message, state);
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

function GetBranchesBlocks(branches, user)
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
				}
			]
		}
		]	
	}	

	for(var i = 0; i < branches.length; i++)
  	{
  		blocks.blocks[1].elements[0].options.push(addBranchOption(branches[i].name, user));
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

async function CheckIfPlatformIsAlreadyInQueue(bot, message, branch, platform)
{
	headers = { "Content-type" : "application/json",
		'Authorization': 'Basic b182563c74cc832f104816a9ecdeee15'};

	var queuedBuildsResponse = await fetch(ListAllBuildsThatAreQueuedURL(), { method: 'GET', headers: headers});
	var queuedBuilds = await queuedBuildsResponse.json();
	
	console.log(queuedBuilds);
	var sameQueuedBuilds = FilterSameBranchAndPlatformForBuilds(queuedBuilds, branch, platform);
	console.log(branch);
	console.log(platform);
	console.log(sameQueuedBuilds);
	return sameQueuedBuilds.length > 0;
}

async function GetSameRunningBuilds(bot, message, branch, platform)
{

	headers = { "Content-type" : "application/json",
		'Authorization': 'Basic b182563c74cc832f104816a9ecdeee15'};

	var runningBuildsResponse = await fetch(ListAllBuildsThatAreRunningURL(), { method: 'GET', headers: headers});
	var runningBuilds = await runningBuildsResponse.json();

	var sameRunningBuilds = FilterSameBranchAndPlatformForBuilds(runningBuilds, branch, platform);

	return sameRunningBuilds;
}

async function GetRunningTimeForPlatfom(bot, message, branch, platform)
{
	var sameRunningBuilds = await GetSameRunningBuilds(bot, message, branch, platform);
	var minutes = 0;
	if (sameRunningBuilds.length > 0)
	{
		var unixTimeZero = Date.parse(sameRunningBuilds[0].buildStartTime);
		var dateNow = new Date();
		minutes = Math.ceil(((dateNow - unixTimeZero)/1000)/60);	
	}
	
	return {isRunning : sameRunningBuilds.length > 0, time : minutes};
}

async function CancelRunningBuilds(bot, message, branch, platform)
{
	var sameRunningBuilds = await GetSameRunningBuilds(bot, message, branch, platform);

	for(var i = 0; i < sameRunningBuilds.length; i++)
	{
		await fetch(GetCancelBuildURL(sameRunningBuilds[i].projectId, sameRunningBuilds[i].buildtargetid, sameRunningBuilds[i].build), { method: 'DELETE', headers: headers});
	}
}

async function TryRunningBuild(bot, message, user, branch, platform)
{
	await CancelRunningBuilds(bot, message, branch, platform);

	var displayName = await getDisplayName(process.env.botToken, message.user);

	botFile.buildUserCache[branch + platform] = displayName;

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
	await bot.replyInteractive(message, "Done!");	
}

async function getPlatformButtonText(bot, message, branch, platform, readablePlatform)
{
	var isInQueue = await CheckIfPlatformIsAlreadyInQueue(bot, message, branch, platform);
	var runState = await GetRunningTimeForPlatfom(bot, message, branch, platform);
	var buttonText = ":" + readablePlatform + ":";
	
	if (isInQueue == true)
	{
		buttonText = ":" + readablePlatform + ": (Already queued)";
	}
	if (runState.isRunning == true)
	{
		buttonText = ":" + readablePlatform + ": (Started " + runState.time + "min ago)";
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
			{
				"type": "button",
				"text": {
					"type": "plain_text",
					"emoji": true,
					"text": "Quit without changing anything"
				},
				"style": "danger",
				"value": "cancel"
			}
		]
	}
]};
}

async function SelectPlatform(bot, message, user, branch)
{
	var blocks = await GetPlatformSelectionBlocks(bot, message, user, branch);

	await bot.replyInteractive(message, blocks);
}



module.exports = function(controller) {

    controller.hears('sample','message,direct_message', async(bot, message) => {
        await bot.reply(message, 'I heard a sample message.');
    });

    controller.on('message,direct_message', async(bot, message) => 
    {
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


