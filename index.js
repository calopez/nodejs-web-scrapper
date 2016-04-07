var request = require("request");
var cheerio = require("cheerio");
var fs = require("fs");
var url = 'http://www.payscale.com';

request({
    uri: url + "/index/US/Job",
}, function(error, response, body) {
    var $ = cheerio.load(body);
    var results = [];

    $(".rcindex .rcIndexBrowse a").each(function(j) {

        var span = $(this);
        var link = span.attr('href');

        if(j < 1) 
            results.push({ uri: url + link, letter: span.text(), jobs: [] });
/*        console.log(url + link);
        console.log(results);*/

        // fs.writeFile('./cheerio_results.json', JSON.stringify(results, null, '\t'));
        /*x('http://www....com', '.rcindex table tr', [{
              job_name: 'td:first-child',
              count: 'td:last-child',
              details: x('td:first-child a @href', '.container h1')
          }]*/

    });

    results.forEach(function(page, i) {
        request({ uri: page.uri }, function(error, response, body) {
            var $ = cheerio.load(body);

            $(".rcindex table tr:nth-child(n + 2)").each(function(j) {
                var tr = $(this);

                 console.info(tr.find('td a').text());
                if(j < 3) 
                    results[i].jobs.push({
                        name: tr.find('td a').text().trim(),
                        count: tr.find('td').last().text().trim(),
                        salary: {},
                        next: url +tr.find('td a').attr('href')
                    });
            });
    
        console.warn('resultados:');
        fs.writeFile('./cheerio_results.json', JSON.stringify(results, null, '\t'));        
            
        });

    }, this);


});