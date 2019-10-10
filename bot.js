require('dotenv').config();
var express = require('express');
const { App, ExpressReceiver } = require('@slack/bolt');
var bodyParser = require('body-parser');
const fetch = require("node-fetch");
var db = require('./features/db-integration');
var slackIntegration = require("./features/slack-integration");

unityHeaders = { "Content-type" : "application/json",
        'Authorization': 'Basic b182563c74cc832f104816a9ecdeee15'};
slackHeaders = { 'Content-type' : 'application/json' };

const receiver = new ExpressReceiver({ signingSecret: process.env.clientSigningSecret, endpoints: '/slack/events' });

receiver.app.get('/foo', () => { /* ... */ });
var server = receiver.app;

server.use(bodyParser.urlencoded({ extended: false }))

server.use(bodyParser.json())

const app = new App({
    token: process.env.botToken,
    receiver
});

slackIntegration.init(app, db);

(
    async () => {
    await app.start(process.env.PORT || 3000);    
})();

app.command('/build', ({ ack, payload, context }) => {
    // Acknowledge the command request
    ack();

    try {
        slackIntegration.open(ack, payload, context);
    }
    catch (error) {
        console.error(error);
    }
});

app.command('/testbuild', ({ ack, payload, context }) => {
    // Acknowledge the command request
    ack();

    try {
        slackIntegration.open(ack, payload, context);
    }
    catch (error) {
        console.error(error);
    }
});


app.action('user_selected', ({ ack, body, context }) => {
    // Acknowledge the button request
    ack();

    try {
        
        const result = slackIntegration.onUserSelected(ack, body, context);
    //const result = slackIntegration.onAddNewBuildClick(ack, body, context);
    }
    catch (error) {
        console.error(error);
    }
});

app.action('branch_selected', ({ ack, body, context }) => {
    // Acknowledge the button request
    ack();

    try {
        const result = slackIntegration.onBranchSelected(ack, body, context);
        // const result = slackIntegration.onUserSelected(ack, body, context);
    //const result = slackIntegration.onAddNewBuildClick(ack, body, context);
    }
    catch (error) {
        console.error(error);
    }
});

app.action('add_new_build', ({ ack, body, context }) => {
    // Acknowledge the button request
    ack();

    try {
        const result = slackIntegration.onAddNewBuildClick(ack, body, context);
    }
    catch (error) {
        console.error(error);
    }
});

app.action('button', ({ ack, body, context }) => {
    // Acknowledge the button request
    ack();

    try {

        var value = JSON.parse(body.actions[0].value);

        if (value.value == "cancel_build")
        {
            const result = slackIntegration.onCancelBuildClick(ack, body, context);    
        }
        
    }
    catch (error) {
        console.error(error);
    }
});

app.action('create_build_ios', ({ ack, body, context }) => {
    // Acknowledge the button request
    ack();

    try {
        const result = slackIntegration.onCreateBuildClick(ack, body, context, "ios");
    }
    catch (error) {
        console.error(error);
    }
});

app.action('create_build_android', ({ ack, body, context }) => {
    // Acknowledge the button request
    ack();

    try {
        const result = slackIntegration.onCreateBuildClick(ack, body, context, "android");
    }
    catch (error) {
        console.error(error);
    }
});

app.action('create_build_both', ({ ack, body, context }) => {
    // Acknowledge the button request
    ack();

    try {
        const result = slackIntegration.onCreateBuildClick(ack, body, context, "both");
    }
    catch (error) {
        console.error(error);
    }
});

// server.post('/slack/events', (req, res) =>
// {
//     console.log("pum");
// });

server.post('/api/unitycloud', (req, res) => 
{
    try {
        var body = req.body;

        if (req.body.buildStatus == "failure")
        {
            onBuildFailed(body);
        }
        if (req.body.buildStatus == "queued")
        {
            onBuildQueued(body);
        }
        if (req.body.buildStatus == "success")
        {
            onBuildSuccess(body);
        }
        if (req.body.buildStatus == "canceled")
        {
            onBuildCanceled(body);
        }
        if (req.body.buildStatus == "started")
        {
            onBuildStarted(body);
        }

        (
            async () => {

            var statesCursor = (await db.getStates());

            var states = await statesCursor.toArray();

            for(var i = 0; i < states.length; i++)
            {
                slackIntegration.reloadView(states[i].state);
            }
        })();

        res.send(`Ok.`);
    }

    catch (error) {
        console.error(error);
    }
});

function getBuildStatusURL(buildData)
{
    var projectid = buildData.projectid;
    var buildtargetid = buildData.buildtargetid;
    var build = buildData.build;

    return 'https://build-api.cloud.unity3d.com/api/v1/orgs/terko/projects/' + projectid + '/buildtargets/' + buildtargetid + '/builds/' + build;
}

function getShareIdURL(buildData)
{
    var projectid = buildData.projectid;
    var buildtargetid = buildData.buildtargetid;
    var build = buildData.build;

    return 'https://build-api.cloud.unity3d.com/api/v1/orgs/terko/projects/' + projectid + '/buildtargets/' + buildtargetid + '/builds/' + build + "/share";
}

function getLogURL(buildData)
{
    var projectid = buildData.projectid;
    var buildtargetid = buildData.buildtargetid;
    var build = buildData.build;

    return 'https://build-api.cloud.unity3d.com/api/v1/orgs/terko/projects/' + projectid + "/buildtargets/" + buildtargetid + '/builds/' + build + "/log?compact=true&linenumbers=true";
}

function hyphenize(str)
{
    return str.replace(/\s+/g, '-').toLowerCase();
}

function getBuildData(body)
{
    return {projectid: hyphenize(body.projectName), buildtargetid: hyphenize(body.buildTargetName), build: body.buildNumber, platform : body.platform};
}


function getBuildStartedPayload()
{
    payload = {"text" : "buildStarted"}

    return JSON.stringify(payload);
}

async function onBuildStarted(body)
{
    var buildData = getBuildData(body);
    var extendedBuildInfo = await getMoreBuildInfo(buildData);

    var branch = extendedBuildInfo.branch;

    var tag = await getUserNotifyTag(extendedBuildInfo.user);

    await say(getBuildInfoPrefix(extendedBuildInfo.branch, buildData.platform, buildData.build)  + " started! :building_construction:" + tag);  
}

async function getShareId(buildData)
{
    var res = await fetch(getShareIdURL(buildData), {
      method: 'get',
      headers: unityHeaders
    });
    var resJson = await res.json();
    return resJson.shareid;
}

async function getShareDetails(shareId)
{
    var res = await fetch("https://build-api.cloud.unity3d.com/api/v1/shares/" + shareId, {
      method: 'get',
      headers: unityHeaders
    });
    var resJson = await res.json();
    return resJson;
}

async function onBuildSuccess(body)
{
    var buildData = getBuildData(body);
    buildData.build = 84;
    buildData.buildtargetid = "android";

    var extendedBuildInfo = await getMoreBuildInfo(buildData);

    var branch = extendedBuildInfo.branch;

    var tag = await getUserNotifyTag(extendedBuildInfo.user);

    var shareId = await getShareId(buildData);

    var shareDetails = await getShareDetails(shareId);

    var shareLink = "https://developer.cloud.unity3d.com/share/share.html?shareId=" + shareId;
    
    var message = {};
    message.text = getBuildInfoPrefix(extendedBuildInfo.branch, buildData.platform, buildData.build) + " successfuly finished! :classical_building: :checkered_flag:" + tag;
    message.icon = shareDetails.links.icon.href;
    
    await sayDownloadApp(message , shareDetails.links.download_primary.href, shareLink, buildData.platform);  
}


async function getBuildStatus(buildData)
{
    var res = await fetch(getBuildStatusURL(buildData), {
      method: 'get',
      headers: unityHeaders
    });
    var resJson = await res.json();
    // console.log(resJson);

    if (resJson.error != null)
    {
        return null;
    }
    return resJson;
}

async function getLog(buildData)
{
    var res = await fetch(getLogURL(buildData), {
      method: 'get',
      headers: unityHeaders
    });
    var resJson = await res.text();

    return resJson;
}

function getBuildInfoPrefix(branch, platform, build)
{
    return "*:" + platform + ": (" + branch + ")* build *#" + build + "*";
}

async function onBuildQueued(body)
{
    var buildData = getBuildData(body);

    var extendedBuildInfo = await getMoreBuildInfo(buildData);

    var branch = extendedBuildInfo.branch;

    var tag = await getUserNotifyTag(extendedBuildInfo.user);

    await say(getBuildInfoPrefix(extendedBuildInfo.branch, buildData.platform, buildData.build) +
     " was put into queue :vertical_traffic_light:" + tag);  
}

async function getMoreBuildInfo(buildData)
{
    var key = buildData.projectid + buildData.platform + buildData.build;
    var userObject = await db.getRunner(key)
    
    if (userObject == null)
    {
        userObject = db.pendingRunners[buildData.projectid + buildData.platform];
    }

    if (userObject == null)
    {
        userObject = {
            branch : "unknown branch",
            user : "unity cloud"
        };
    }

    return userObject;
}

async function getUserNotifyTag(user)
{
    return " <@" + user + ">";
}

async function onBuildCanceled(body)
{
    var buildData = getBuildData(body);
    var extendedBuildInfo = await getMoreBuildInfo(buildData);

    var branch = extendedBuildInfo.branch;

    var tag = await getUserNotifyTag(extendedBuildInfo.user);

    await say("~" + getBuildInfoPrefix(extendedBuildInfo.branch, buildData.platform, buildData.build) + " was canceled~ :heavy_multiplication_x:" + tag);  
}

async function onBuildFailed(body)
{
    var buildData = getBuildData(body);
    var extendedBuildInfo = await getMoreBuildInfo(buildData);

    var branch = extendedBuildInfo.scmBranch;
    var log = await getLog(buildData);
    var codeLog = "\n```" + log + "```";

    var tag = await getUserNotifyTag(extendedBuildInfo.user);
    await say(getBuildInfoPrefix(extendedBuildInfo.branch, buildData.platform, buildData.build) + " FAILED :x:"  + tag + codeLog);  
}


async function say(message)
{
    
    var req = {
              method: 'POST',
              headers: slackHeaders,
              body: JSON.stringify({
                    "type": "modal",
                    "title": {
                        "type": "plain_text",
                        "text": "My App",
                        "emoji": true
                    },
                    "submit": {
                        "type": "plain_text",
                        "text": "Submit",
                        "emoji": true
                    },
                    "close": {
                        "type": "plain_text",
                        "text": "Cancel",
                        "emoji": true
                    },
                    "blocks": [
                        {
                            "type": "context",
                            "elements": [
                                {
                                    "type": "mrkdwn",
                                    "text": message
                                }
                            ]
                        }
                    ]
            })
    };

    await fetch(process.env.slackUrl, req);
}

async function sayDownloadApp(message, downloadLink, installLink, platform)
{
    await fetch(process.env.slackUrl, {
      method: 'POST',
      headers: slackHeaders,
      body: JSON.stringify({
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": "Prototypes Builder",
                "emoji": true
            },
            "submit": {
                "type": "plain_text",
                "text": "Submit",
                "emoji": true
            },
            "close": {
                "type": "plain_text",
                "text": "Cancel",
                "emoji": true
            },
            "blocks": [
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "image",
                            "image_url": message.icon,
                            "alt_text": "images"
                        },
                        {
                            "type": "mrkdwn",
                            "text": message.text
                        }
                    ]
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "emoji": true,
                                "text": "Install :" + platform + ":"
                            },
                            "style": "primary",
                            "url": installLink
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "emoji": true,
                                "text": "Download :" + platform + ":"
                            },
                            "style": "primary",
                            "url": downloadLink
                        }
                    ]
                }
            ]
        })
    });
}