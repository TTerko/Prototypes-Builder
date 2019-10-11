const mongo = require('mongodb');

const url = "mongodb+srv://terko:terkoterko@cluster0-vwvvj.mongodb.net/test?retryWrites=true&w=majority";

var dbo = {};
var runningBuildsCollection = {};
var statesCollection = {};
var buildsCollection = {};
var latestBuildsCollection = {};

mongo.connect(url, {useNewUrlParser: true}, (err, db) => {
        if(err) {
           console.log(err);
           process.exit(0);
        }

        dbo = db.db('slack-integration');

        runningBuildsCollection = dbo.collection('running_builds');
        statesCollection = dbo.collection('states');
        buildsCollection = dbo.collection('builds');
        latestBuildsCollection = dbo.collection('latest_builds');

        console.log("database connected");
}); 

async function updateState(user, state)
{
    await statesCollection.updateOne({user: user}, {'$set': {'state': state}}, {"upsert" : true}, (err, results) => {
        
    });
}

async function getStates ()
{
    return await statesCollection.find();
}

async function getState (user)
{
    return await statesCollection.findOne({user: user});
}

async function updateRunner(projectId, platform, branch, build, user)
{
    var user = 
    {
        projectId: projectId,
        branch: branch,
        platform: platform,
        build: build,
        user: user
    }
    await runningBuildsCollection.updateOne({projectId: projectId, platform: platform, build: build}, {'$set': user}, {"upsert" : true});
}

async function getRunner (projectId, platform, build)
{
    return await runningBuildsCollection.findOne({projectId: projectId, platform: platform, build: build});
}

async function removeRunner (projectId, platform, build)
{
    return await runningBuildsCollection.removeOne({projectId: projectId, platform: platform, build: build});
}


async function getBuilds()
{
    return (await latestBuildsCollection.find()).toArray();
}

async function addBuild(buildId, projectId, branch, platform, build, runnerId, downloadUrl, shareUrl, iconUrl)
{
    var date = new Date();

    var latestBuild =
    {
        buildId : buildId,
        projectId : projectId,
        branch : branch,
        runnerId : runnerId,
        [platform + "Build"] : build,
        [platform + "DownloadUrl"] : downloadUrl,
        [platform + "ShareUrl"] : shareUrl,
        iconUrl : iconUrl,
        [platform + "TimeStamp"] : date.getTime()
    }

    var build =
    {
        buildId : buildId,
        projectId : projectId,
        branch : branch,
        platform : platform,
        build : build,
        runnerId : runnerId,
        downloadUrl : downloadUrl,
        shareUrl : shareUrl,
        iconUrl : iconUrl,
        timeStamp : date.getTime()
    }

    latestBuildsCollection.updateOne({buildId: buildId}, {'$set': latestBuild}, {"upsert" : true});
    buildsCollection.insertOne(build);
}

var pendingRunners = {};

module.exports = {
    updateRunner : updateRunner,
    getRunner : getRunner,
    updateState : updateState,
    getState : getState,
    getStates : getStates,
    getBuilds : getBuilds,
    addBuild : addBuild,
    removeRunner : removeRunner,
    pendingRunners : pendingRunners
};