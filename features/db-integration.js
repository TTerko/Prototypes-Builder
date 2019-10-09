const mongo = require('mongodb');

const url = "mongodb+srv://terko:terkoterko@cluster0-vwvvj.mongodb.net/test?retryWrites=true&w=majority";

var dbo = {};
var runningBuildsCollection = {};

mongo.connect(url, {useNewUrlParser: true}, (err, db) => {
        if(err) {
           console.log(err);
           process.exit(0);
        }

        dbo = db.db('slack-integration');

        runningBuildsCollection = dbo.collection('running_builds');
        console.log("database connected");
}); 

async function updateRunner(value, user)
{
    await runningBuildsCollection.updateOne({build: value}, {'$set': {'user': user}}, {"upsert" : true}, (err, results) => {
        
    });
}
async function getRunner (value)
{
    return await runningBuildsCollection.findOne({build: value});
}

module.exports = {
    updateRunner : updateRunner,
    getRunner : getRunner
};