// Parses the development applications at the South Australian City of Tea Tree Gully web site and
// places them in a database.
//
// Michael Bone
// 5th August 2018
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cheerio = require("cheerio");
const request = require("request-promise-native");
const sqlite3 = require("sqlite3");
const moment = require("moment");
sqlite3.verbose();
const DevelopmentApplicationMainUrl = "https://www.ecouncil.teatreegully.sa.gov.au/eservice/dialog/daEnquiryInit.do?nodeNum=131612";
const DevelopmentApplicationSearchUrl = "https://www.ecouncil.teatreegully.sa.gov.au/eservice/dialog/daEnquiry.do?number=&lodgeRangeType=on&dateFrom={0}&dateTo={1}&detDateFromString=&detDateToString=&streetName=&suburb=0&unitNum=&houseNum=0%0D%0A%09%09%09%09%09&searchMode=A&submitButton=Search";
const CommentUrl = "mailto:customerservice@cttg.sa.gov.au";
// Sets up an sqlite database.
async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        let database = new sqlite3.Database("data.sqlite");
        database.serialize(() => {
            database.run("create table if not exists [data] ([council_reference] text primary key, [address] text, [description] text, [info_url] text, [comment_url] text, [date_scraped] text, [date_received] text, [on_notice_from] text, [on_notice_to] text)");
            resolve(database);
        });
    });
}
// Inserts a row in the database if it does not already exist.
async function insertRow(database, developmentApplication) {
    return new Promise((resolve, reject) => {
        let sqlStatement = database.prepare("insert or ignore into [data] values (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        sqlStatement.run([
            developmentApplication.applicationNumber,
            developmentApplication.address,
            developmentApplication.reason,
            developmentApplication.informationUrl,
            developmentApplication.commentUrl,
            developmentApplication.scrapeDate,
            developmentApplication.receivedDate,
            null,
            null
        ], function (error, row) {
            if (error) {
                console.error(error);
                reject(error);
            }
            else {
                if (this.changes > 0)
                    console.log(`    Inserted: application \"${developmentApplication.applicationNumber}\" with address \"${developmentApplication.address}\" and reason \"${developmentApplication.reason}\" into the database.`);
                else
                    console.log(`    Skipped: application \"${developmentApplication.applicationNumber}\" with address \"${developmentApplication.address}\" and reason \"${developmentApplication.reason}\" because it was already present in the database.`);
                sqlStatement.finalize(); // releases any locks
                resolve(row);
            }
        });
    });
}
// Parses the development applications.
async function main() {
    // Ensure that the database exists.
    let database = await initializeDatabase();
    // Retrieve the main page.
    console.log(`Retrieving page: ${DevelopmentApplicationMainUrl}`);
    let jar = request.jar(); // this cookie jar will end up containing the JSESSIONID_live cookie after the first request; the cookie is required for the second request
    await request({ url: DevelopmentApplicationMainUrl, jar: jar });
    // Retrieve the results of a search for the last month.
    let dateFrom = encodeURIComponent(moment().subtract(1, "months").format("DD/MM/YYYY"));
    let dateTo = encodeURIComponent(moment().format("DD/MM/YYYY"));
    let developmentApplicationSearchUrl = DevelopmentApplicationSearchUrl.replace(/\{0\}/g, dateFrom).replace(/\{1\}/g, dateTo);
    console.log(`Retrieving search results for: ${developmentApplicationSearchUrl}`);
    let body = await request({ url: developmentApplicationSearchUrl, jar: jar }); // the cookie jar contains the JSESSIONID_live cookie
    let $ = cheerio.load(body);
    // Parse the search results.
    for (let headerElement of $("h4.non_table_headers").get()) {
        // Reduce multiple consecutive spaces in the address to a single space.
        let address = $(headerElement).text().trim().replace(/\s\s+/g, " ");
        // Remove unwanted suffixes from the address.  These appear after a dash.  Take care not
        // to accidentally recognise any dashes in the house number as the start of a suffix (by
        // starting the search for dashes after the state abbreviation, "SA").
        let stateIndex = address.indexOf(" SA ");
        if (stateIndex >= 0) {
            let suffixIndex = address.indexOf(" - ", stateIndex);
            if (suffixIndex >= 0)
                address = address.substring(0, suffixIndex); // for example, removes " - Building Rules Application"
        }
        let applicationNumber = "";
        let reason = "";
        let receivedDate = moment.invalid();
        for (let divElement of $(headerElement).next("div").get()) {
            for (let paragraphElement of $(divElement).find("p.rowDataOnly").get()) {
                let key = $(paragraphElement).children("span.key").text().trim();
                let value = $(paragraphElement).children("span.inputField").text().trim();
                if (key === "Type of Work")
                    reason = value;
                else if (key === "Application No.")
                    applicationNumber = value;
                else if (key === "Date Lodged")
                    receivedDate = moment(value, "D/MM/YYYY", true); // allows the leading zero of the day to be omitted
            }
        }
        // Ensure that at least an application number and address have been obtained.
        if (applicationNumber !== "" && address !== "") {
            await insertRow(database, {
                applicationNumber: applicationNumber,
                address: address,
                reason: reason,
                informationUrl: DevelopmentApplicationMainUrl,
                commentUrl: CommentUrl,
                scrapeDate: moment().format("YYYY-MM-DD"),
                receivedDate: receivedDate.isValid ? receivedDate.format("YYYY-MM-DD") : ""
            });
        }
    }
}
main().then(() => console.log("Complete.")).catch(error => console.error(error));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyYXBlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNjcmFwZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsa0dBQWtHO0FBQ2xHLDZCQUE2QjtBQUM3QixFQUFFO0FBQ0YsZUFBZTtBQUNmLGtCQUFrQjtBQUVsQixZQUFZLENBQUM7O0FBRWIsbUNBQW1DO0FBQ25DLGtEQUFrRDtBQUNsRCxtQ0FBbUM7QUFDbkMsaUNBQWlDO0FBRWpDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUVsQixNQUFNLDZCQUE2QixHQUFHLDZGQUE2RixDQUFDO0FBQ3BJLE1BQU0sK0JBQStCLEdBQUcsK1BBQStQLENBQUM7QUFDeFMsTUFBTSxVQUFVLEdBQUcsdUNBQXVDLENBQUM7QUFFM0QsOEJBQThCO0FBRTlCLEtBQUssVUFBVSxrQkFBa0I7SUFDN0IsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtRQUNuQyxJQUFJLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDbkQsUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUU7WUFDcEIsUUFBUSxDQUFDLEdBQUcsQ0FBQywwT0FBME8sQ0FBQyxDQUFDO1lBQ3pQLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN0QixDQUFDLENBQUMsQ0FBQztJQUNQLENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQztBQUVELDhEQUE4RDtBQUU5RCxLQUFLLFVBQVUsU0FBUyxDQUFDLFFBQVEsRUFBRSxzQkFBc0I7SUFDckQsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtRQUNuQyxJQUFJLFlBQVksR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLGlFQUFpRSxDQUFDLENBQUM7UUFDdkcsWUFBWSxDQUFDLEdBQUcsQ0FBQztZQUNiLHNCQUFzQixDQUFDLGlCQUFpQjtZQUN4QyxzQkFB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