const mongo = require('mongodb');

const url = "mongodb+srv://terko:terkoterko@cluster0-vwvvj.mongodb.net/test?retryWrites=true&w=majority";

var dbo = {};
var runningBuildsCollection = {};
var statesCollection = {};
var buildsCollection = {};

mongo.connect(url, {useNewUrlParser: true}, (err, db) => {
        if(err) {
           console.log(err);
           process.exit(0);
        }

        dbo = db.db('slack-integration');

        runningBuildsCollection = dbo.collection('running_builds');
        statesCollection = dbo.collection('states');
        buildsCollection = dbo.collection('builds');

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

async function updateRunner(value, user)
{
    await runningBuildsCollection.updateOne({build: value}, {'$set': user}, {"upsert" : true}, (err, results) => {
        
    });
}
async function getRunner (value)
{
    return await runningBuildsCollection.findOne({build: value});
}

var pendingRunners = {};

module.exports = {
    updateRunner : updateRunner,
    getRunner : getRunner,
    updateState : updateState,
    getState : getState,
    getStates : getStates,
    pendingRunners : pendingRunners
};