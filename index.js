var request = require("request");
var cheerio = require("cheerio");
var fs = require("fs");
var url = 'http://www.payscale.com';
var global_position;
request({
    uri: url + "/index/US/Job",
}, function(error, response, body) {
    var $ = cheerio.load(body);
    var data = {};

    /* ----------------------------------------------------
     *     ABC - links
     * ---------------------------------------------------- */

    $(".rcindex .rcIndexBrowse a").each(function(j) {

        var span = $(this);
        var link = span.attr('href');
        var letter;

        if (j < 2) {
            letter = data[span.text()] = {};
            letter.self = url + link;
            letter.jobs = [];
            console.info(data);
            console.info(letter);
        }

        /*   
                // fs.writeFile('./cheerio_results.json', JSON.stringify(results, null, '\t'));
                /*x('http://www....com', '.rcindex table tr', [{
                      job_name: 'td:first-child',
                      count: 'td:last-child',
                      details: x('td:first-child a @href', '.container h1')
                  }]*/

    });

    /* ----------------------------------------------------
     *  Positions by letter.  Nested for now - TODO: use asyn.js
     * ---------------------------------------------------- */

    Object.keys(data).forEach(function(letter) {
        var page = data[letter];

        request({ uri: page.self }, function(error, response, body) {
            var $ = cheerio.load(body);

            $(".rcindex table tr:nth-child(n + 2)").each(function(j) {
                var tr = $(this);

                if (j < 2)
                    data[letter].jobs.push({
                        name: tr.find('td a').text().trim(),
                        count: tr.find('td').last().text().trim(),
                        salary: {},
                        self: url + tr.find('td a').attr('href')
                    });
            });

            /* ----------------------------------------------------
            *  Salary by Position -  Nested for now - TODO: use asyn.js
            * ---------------------------------------------------- */
            Object.keys(data).forEach(function(letter) {
                var page = data[letter];
                var jobs = page.jobs;
                
                jobs.forEach(function(position) {
                 global_position = position;
                request({ uri: position.self }, function(error, response, body) {
                    
                    var $ = cheerio.load(body);
                    
                    var getTable = function(id) {
                        return $(id)
                            .find('table')
                            .first()
                            .find('tr:nth-child(n+2)');
                    },
                    getValue = function(table, row, col) {
                        return table.eq(row).find('td').eq(col).html();
                    };
                    
                    var anualSalary = getTable('#m_summaryReport'),
                    salary = getValue(anualSalary, 0, 0),
                    bonus = getValue(anualSalary, 1, 0),
                    totalPay =  getValue(anualSalary, 2, 0);
                    
                    var hourlyRate = getTable('#m_summaryReport_hourly'),
                    rate = getValue(hourlyRate, 0, 0),
                    overtime = getValue(hourlyRate, 1, 0);   
                    
                    position.salary.anual = {
                        salary: salary,
                            bonus: bonus
                    };
                    
                    position.salary.hourly = {
                            rate: rate,
                            overtime: overtime
                    };
                                        
                    console.info(salary);
                    console.info(bonus);                                   
                                                       
                    
                    
                });


                });



            });


            console.warn('resultados:');
            fs.writeFile('./cheerio_results.json', JSON.stringify(data, null, '\t'));



        });

    });


});