/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

const request = require("request");
const fetch = require('node-fetch');	

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

function LogBranches(branches)
{
	for(var i = 0; i < branches.length; i++)
	  	{
	  		console.log(branches[i].name);
	  	}
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
		console.log(await bot.replyInteractive(message, GetBranchesBlocks(branches, user)));
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

async function UpdateBuildTarget(user, branch, platform)
{
	var body = {};
	body.settings = {};
	body.settings.scm = {};
	body.settings.scm.branch = branch;
	body.settings.platform = {};

	headers = { "Content-type" : "application/json",
			'Authorization': 'Basic b182563c74cc832f104816a9ecdeee15'};

	const buildsResponse = await fetch(GetStartBuildURL(user, platform), { method: 'GET', headers: headers});
	const builds = await buildsResponse.json();
	var postfix = "";

	if (builds.length > 0)
	{
		postfix = builds[0].build;
	}
	var bundleIdCompanyName = "501";
	if (platform == "android")
	{
		bundleIdCompanyName = "studio501";
	}

	body.settings.platform.bundleId = "com." + bundleIdCompanyName + "." + branch.replace(/[^a-zA-Z ]/g + postfix, "");

	await fetch(GetCloudBuildTargetURL(user, platform), { method: 'PUT', headers: headers, body:  JSON.stringify(body)});
	console.log(GetStartBuildURL(user, platform));
	await fetch(GetStartBuildURL(user, platform), { method: 'POST', headers: headers});
	//const buildTargetResponseJson = await buildTargetResponse.json();	
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

function GetPlatformSelectionBlocks(user, branch)
{
	var iosValue = {};
	iosValue.user = user;
	iosValue.branch = branch;
	iosValue.platform = "ios";
	
	var androidValue = {};
	androidValue.user = user;
	androidValue.branch = branch;
	androidValue.platform = "android";
	
	return {blocks: [
	{
		"type": "actions",
		"elements": [
			{
				"type": "button",
				"text": {
					"type": "plain_text",
					"emoji": true,
					"text": "iOS"
				},
				"style": "primary",
				"value": JSON.stringify(iosValue)
			},
			{
				"type": "button",
				"text": {
					"type": "plain_text",
					"emoji": true,
					"text": "Android"
				},
				"style": "primary",
				"value": JSON.stringify(androidValue)
			},
			{
				"type": "button",
				"text": {
					"type": "plain_text",
					"emoji": true,
					"text": "Cancel"
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
	await bot.replyInteractive(message, GetPlatformSelectionBlocks(user, branch));
}

async function onButtonSelected(bot, message)
{
	if (message.actions[0].value == "cancel")
	{
		bot.replyInteractive(message, "Build canceled");
		// bot.deleteMessage(message);
	}
	else
	{
		var value = JSON.parse(message.actions[0].value);

		var user = value.user;
		var branch = value.branch;
		var platform = value.platform;

		const result = await UpdateBuildTarget(user, branch, platform);
		await bot.replyInteractive(message, "*" + platform + " " + branch + "* build successfuly initiated! :check:");
	}
}

module.exports = function(controller) {

    controller.hears('sample','message,direct_message', async(bot, message) => {
        await bot.reply(message, 'I heard a sample message.');
    });

    controller.on('message,direct_message', async(bot, message) => 
    {
		if (message.actions.length > 0)
		{
			console.log(message.actions[0]);
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


