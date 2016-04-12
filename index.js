#!/usr/bin/env node

var Q = require('q'),
    r = require("request"),
    async = require("async"),
    request = Q.denodeify(r),
    htmlParser = require('./html_parser'),
    fs = require("fs"),
    argv = require('optimist').argv,
    PARAM = readArgs(argv),
    url = 'http://www.payscale.com';

Q.longStackSupport = true;



/** _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
 *
 * Main process
 *  _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
 */

var listOfPages, // list of pages that have not been processed.
    controlFile = 'remaining.json';

if (!fs.existsSync('results')) fs.mkdirSync('results');

console.time('total');

request({uri: url + "/index/US/Job"}).spread(function(response, body) { // get pages to process
    var startCollecting, content = "", len;

    startCollecting = function(){
        var data = htmlParser.getListOfPages(body);
        fs.writeFileSync(controlFile, JSON.stringify(data, null, '\t'));
        return data;
    };

    if(PARAM.restart) {

        listOfPages = startCollecting();
        content = JSON.stringify(listOfPages); // clone
        fs.writeFileSync(controlFile, content);

        return Q.fcall(function() {return JSON.parse(content); /*clone of json listOfPages*/});
    }

    if (fs.existsSync(controlFile)) content = fs.readFileSync(controlFile);

    len = content.length;

    if(len === 0) {
        listOfPages = startCollecting(); // new process

    } else if(len > 0 && len < 3) { // if content is like "{}" process already completed
        console.log("It seems the process was already completed.");
        console.log("See results in ./results folder.");
        console.log("If you want to restart the process use --restart");
        process.exit();

    } else {

        listOfPages = JSON.parse(content); // in progress
    }


    return Q.fcall(function() {return JSON.parse(content);});

}).then(function(data) { // for each A|B|C|...|Z page create a request promise

    var requestByLetterPromises = [];

    // create a request promise for each letter page.
    Object.keys(data).forEach(function(letter) {
        requestByLetterPromises.push({
            letter: letter,
            request: request({uri: data[letter].self})
        });
    });

    return Q.fcall(function() {return [data, requestByLetterPromises];});

}).spread(function(data, requestByLetterPromises) { // process each A|B|C|...|Z page sync

    async.eachSeries(requestByLetterPromises, function(promise, callback){
        console.time(promise.letter);
        processJobsByLetter(data[promise.letter], promise.request, callback);

    }, function(err){

        console.timeEnd('total');
    });

}).done();


/**
 * @description Write in a file the information of all jobs by a given letter
 * @param {object} letter Container
 * @param {Promise} req  Request to get html of the current page/letter
 */
function processJobsByLetter(letter, req, completejobsByLetter) {

    async.waterfall([
        function(next) { // get list of jobs

            req.spread(function(response, body) {
                letter.jobs = htmlParser.getListOfJobs(body);
                next(null, letter.jobs);
            }).fail(function(err){next(err);});

        },
        function(jobs, next) {

            var deferred = Q.defer(),
                processed = 0,
                jobsNumber =jobs.length;

            // for each job in the list of the current letter. Max PARAM.concurrency request(s) at a time.
            async.forEachOfLimit(jobs, PARAM.concurrency, function(job, index, complete){
                console.info('request('+index+') '+ job.self);
                request({uri: job.self}).spread(function(response, body) {

                    htmlParser.getSalaryByJob(job, body);
                    processed++;
                    complete(null);

                }).done();

            }, function(err){
                if(err) next(err);
                console.log(letter.id + '> ' + processed );
                processed = 0;
                next(null, jobs);
            });
        }

    ], function (err, jobsInfo) {

        if (err) console.error(err.messasge);

        fs.writeFileSync('./results/' + letter.id + '_results.json', JSON.stringify(jobsInfo, null, '\t'));

        delete listOfPages[letter.id];

        fs.writeFileSync('./remaining.json', JSON.stringify(listOfPages, null, '\t'));

        console.timeEnd(letter.id);

        completejobsByLetter(); // 'done'
    });

}

/** _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
 *
 *                 Utilities
 *  _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
 */
// isNaN would return true if a string or undefined is passed because of Javascript coercion
function valueIsNaN(v) {
    return v !== v;
}

function readArgs(argv) {
    var concurrency = !!argv.concurrency ? Number(argv.concurrency) : 100;

    return {
        restart: Boolean(argv.restart),
        concurrency: valueIsNaN(concurrency) ? 100 : concurrency
    };
}
