#!/usr/bin/env node

var cheerio = require("cheerio"),
    url = 'http://www.payscale.com',
    lettersLimit = Infinity, // for dev
    jobsByLetterLimit = Infinity; // for dev

var exports = module.exports = {};

/**
 * Get the list of pages to process A|B|C|...|Z
 * @param {string} html body of the page
 * @returns {object} indexed pages meta information
 */
exports.getListOfPages = function (html) {
    var $ = cheerio.load(html),
        pages = {};

    $(".rcindex .rcIndexBrowse a").each(function(j) {
        var page,
            span = $(this),
            link = span.attr('href');

        if (j < lettersLimit) {
            page = pages[span.text()] = {};
            page.id = span.text();
            page.self = url + link;
            page.jobs = [];
        }
    });
    return pages;

};


/**
 * Get the list of jobs/links from the current html page
 * @param {string} html body of one of the A|B|C pages
 * @returns {array} list of jobs
 */
exports.getListOfJobs = function (html) {
    var $ = cheerio.load(html), jobs = [];

    $(".rcindex table tr:nth-child(n + 2)").each(function(j) {
        var tr = $(this);

        if (j < jobsByLetterLimit)
            jobs.push({
                name: tr.find('td a').text().trim(),
                data_profiles_number: tr.find('td').last().text().trim(),
                salary: {},
                self: url + tr.find('td a').attr('href')
            });
    });

    return jobs;

};


/**
 *
 * @param {} position reference to job object property
 * @param {} html
 * @returns {}
 */
exports.getSalaryByJob = function (position, html) {

    var $ = cheerio.load(html);
    var b = $('body').find('h1');
    var t = $('body').find('#summaryReport');

    var getTable = function(id) {
        return $(id)
            .find('table')
            .first()
            .find('tr:nth-child(n+2)');
    };

    var anualSalaryTable = getTable('#m_summaryReport'),
        hourlyRateTable = getTable('#m_summaryReport_hourly');

    var footNoteText = anualSalaryTable.slice(-1).find('td').text(),
        footnote = parseFootNote(footNoteText);

    position.salary.footnote = footnote;

    anualSalaryTable = anualSalaryTable.slice(0, anualSalaryTable.length - 1);
    position.salary.anual = parseTable(anualSalaryTable);
    position.salary.hourly = parseTable(hourlyRateTable);

};

var util = {
    /**
     * @description  convert from ['$24,416', '$61,905.80'] to [24416, 61905.80]
     * @param {} string array
     * @returns {} number array
     */
    getNumbers: function(list) {
        return list.map(function(value) {
            return parseFloat(value.replace(/[^\d.-]/g, ''));
        });
    },
    toValidObjectPropertyName: function(str){
        return str.trim().replace(' ', '_').toLowerCase();
    }
};


/**
 * @description Convert from text to js object
 * From:
 * "Country: USA | Currency: USD | Updated: 1 Jan 2016 | Individuals Reporting: 180 "
 * To:
 * {
 * "country": "USA",
 * "currency": "USD",
 * "updated": "1 Jan 2016",
 * "indivituals_reporting": 180
 * }
 * @param {string} text
 * @returns {json} text parsed in json format
 */
function parseFootNote(text) {

    var footNote = text.trim().split('|').reduce(function(footnote, current) {
        var tuple = current.split(':'),
            field = util.toValidObjectPropertyName(tuple[0]),
            value = tuple[1];

        //TODO: validate if valid number convert to Number, same for dates
        footnote[field] = tuple[1].trim();
        return footnote;

    }, {});

    return footNote;
}


/**
 * @description
 * Convert the cheerio html table to a js object.
 * e.g
 * from this table:
 * +---------------+-------------------+--+---+--+
 * | Salary        | $23,966 - $60,278 |  |   |  |
 * | Bonus         | $1,750            |  |   |  |
 * | Total Pay (?) | $24,416 - $61,905 |  |   |  |
 * +---------------+-------------------+--+---+--+
 * to this object:
 * {
 *     salary: [23966, 60, 78],
 *     bonus: [1750],
 *     total_pay: [24416, 61905]
 * }
 *
 * @param {cheerio Object} table cheerio object
 * @returns {object} table parsed in json format
 */
function parseTable(table) {

    var $ = cheerio.load('</b>');
    var getNumbers, salary = {};

    table.each(function(i, row) {
        var field = $(this).find('th strong').children().remove().end().text(),
            value = $(this).find('td').first().text();

        field = util.toValidObjectPropertyName(field);
        salary[field] = util.getNumbers(value.split(' - '));

    });

    return salary;
}
