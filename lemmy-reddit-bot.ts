'use strict';
import snoowrap from 'snoowrap';
import LemmyBot from 'lemmy-bot';
import { load } from 'node-yaml-config';

const config = load(process.env.BOT_CONFIG || __dirname + '/config.yml');
const lemmy_post_base = config.lemmy_post_base || "https://" + config.lemmy_instance + "/post/"

if (config.dump_json || false){
    console.log(config);
}

const r = new snoowrap({
    userAgent: config.user_agent || 'saunabot',
    clientId: config.client_id,
    clientSecret: config.client_secret,
    username: config.reddit_username,
    password: config.reddit_password
});

// TODO: might want to flag NSFW eventually as well
function republishPost(postTitle: string, postURL: string, community: string){
    var flairId;
    var postData;

    if (community in config.flair_mappings){
        flairId = config.flair_mappings[community];
    } else if ("default_flair" in config) {
        flairId = config.default_flair;
    }

    if (flairId){
        console.log(postTitle + " at " + postURL + " in " + community + " with flair " + flairId);
        postData = {
            title: postTitle,
            url: postURL,
            subredditName: config.reddit_subreddit,
            flairId: flairId
        };
    } else {
        console.log(postTitle + " at " + postURL + " in " + community);
        postData={
            title: postTitle,
            url: postURL,
            subredditName: config.reddit_subreddit
        };
    }

    r.submitLink(postData).then(submission => {
        if ("comment" in config){
            submission.reply(config.comment);
        }
    });
}

const bot = new LemmyBot({
    instance: config.lemmy_instance,
    dbFile: config.lemmy_db || 'db.sqlite3',
    handlers: {
        post: (res) => {
            if (config.lemmy_communities.includes(res.postView.community.name)){
                if (config.dump_json || false){
                    console.log("New event:\n");
                    console.log(res.postView);
                    console.log("\n");
                }
                // ap_id points to the original instance - this configures if we point to the original instance,
                // or to our instance
                if (config.lemmy_rewrite_instance){
                    republishPost(res.postView.post.name, lemmy_post_base + res.postView.post.id, res.postView.community.name);
                } else {
                    republishPost(res.postView.post.name, res.postView.post.ap_id, res.postView.community.name);
                }
            } else {
                console.log("Skipping post in unmonitored community: " + res.postView.community.name);
            }
        }
    }
});

bot.start();
