const fs = require('fs-extra');
const axios = require('axios');
const moment = require('moment');
const validator = require('validator');
const Utility = require('../lib/utils');
const config_dir = require('../../config/dir.json');
const config_test = require("../../config/test.json");

 
module.exports = function(app, checkAuthorisation, database) {

    app.get("//api/oidc/authrequest/:testcase", async function(req, res) {

        // check if apikey is correct
        let authorisation = checkAuthorisation(req);
        if(!authorisation) {
            error = {code: 401, msg: "Unauthorized"};
            res.status(error.code).send(error.msg);
            return null;
        }

        let testcase = req.params.testcase;
        let user = (authorisation=='API')? req.body.user : req.session.user;
        let store_type = (authorisation=='API')? req.query.store_type : (req.session.store_type)? req.session.store_type : 'test';

        if(!store_type) { return res.status(400).send("Parameter store_type is missing"); }

        let metadata = (authorisation=='API')? database.getMetadata(req.query.user, store_type) : req.session.store.metadata;

        let testsuite = "oidc-core";
        let hook = "authentication-request";

        let tests = config_test[testsuite].cases[testcase].hook[hook]; 
        let testcase_name = config_test[testsuite].cases[testcase].name;
        let testcase_description = config_test[testsuite].cases[testcase].description;
        let testcase_referements = config_test[testsuite].cases[testcase].ref;
        console.log("Test case name: " + testcase_name);
        console.log("Referements: " + testcase_referements);
        console.log("Test list to be executed: ", tests);

        let authrequest = {};
        let test = null;
        for(t in tests) {
            let TestAuthRequestClass = require("../../test/" + tests[t]);
            test = new TestAuthRequestClass(metadata, authrequest);
            if(test.hook==hook) {
                authrequest = await test.getResult();

                // save request
                database.saveRequest(authrequest.state, user, store_type, testsuite, testcase, authrequest);
            }
        }

        console.log("Authorization Request", authrequest);
        res.status(200).send(authrequest);
    });


    app.get("//redirect", async function(req, res) {
        
        let report = [];
        let num_success = 0;
        let num_warning = 0;
        let num_failure = 0;

        let authresponse = req.query;
        console.log("Authentication Response", authresponse);

        // get authcode
        let authcode = authresponse.code;
        let state = authresponse.state;

        let user = req.session.user;
        let store_type = (req.session.store_type)? req.session.store_type : 'test';
        let organization = (req.session.entity)? req.session.entity.id : null;
        let external_code = req.session.external_code;

        if(!user) { return res.status(400).send("Parameter user is missing"); }
        if(!store_type) { return res.status(400).send("Parameter store_type is missing"); }
        //if(!organization) { return res.status(400).send("Parameter organization is missing"); }
        //if(!external_code) { return res.status(400).send("Parameter external_code is missing"); }

        let metadata = database.getMetadata(user, store_type);
        if(!metadata || !metadata.configuration) { return res.status(400).send("Please download metadata first"); }

        // retrieve request
        let request = database.getRequest(state);
        let authrequest = request.authrequest;
        console.log("Saved Request", request);

        let testsuite = request.testsuite;
        let testcase = request.testcase;

        {   // authentication response
            let hook = "authentication-response";

            let tests = config_test[testsuite].cases[testcase].hook[hook]; 
            let testcase_name = config_test[testsuite].cases[testcase].name;
            let testcase_description = config_test[testsuite].cases[testcase].description;
            let testcase_referements = config_test[testsuite].cases[testcase].ref;
            console.log("Test case name: " + testcase_name);
            console.log("Referements: " + testcase_referements);
            console.log("Test list to be executed: ", tests);

            for(let t in tests) {
                let TestAuthResponseClass = require("../../test/" + tests[t]);
                test = new TestAuthResponseClass(metadata, authrequest, authresponse);
                if(test.hook==hook) {
                    result = await test.getResult();

                    switch(test.validation) {
                        case 'automatic':
                            switch(result.result) {
                                case 'success': num_success++; break;
                                case 'failure': num_failure++; break;
                            }
                        break;
                        case 'self': num_warning++; break;
                        case 'required': num_warning++; break;
                    }

                    // save single test to store
                    database.setTest(user, external_code, store_type, testsuite, testcase, hook, result);

                    console.log(result);
                    report.push(result);
                }
            }
        }

        let tokenrequest = {};
        let tokenresponse = {};

        { // token request
            let hook = "token-request";

            let tests = config_test[testsuite].cases[testcase].hook[hook]; 
            let testcase_name = config_test[testsuite].cases[testcase].name;
            let testcase_description = config_test[testsuite].cases[testcase].description;
            let testcase_referements = config_test[testsuite].cases[testcase].ref;
            console.log("Test case name: " + testcase_name);
            console.log("Referements: " + testcase_referements);
            console.log("Test list to be executed: ", tests);

            let test = null;
            for(let t in tests) {
                let TestTokenRequestClass = require("../../test/" + tests[t]);
                test = new TestTokenRequestClass(metadata, authrequest, authresponse, tokenrequest);
                if(test.hook==hook) {
                    tokenrequest = await test.getResult();

                    switch(test.validation) {
                        case 'self': num_warning++; break;
                        case 'required': num_warning++; break;
                    }
                    
                    // save request
                    //database.saveRequest(authrequest.state, user, store_type, testsuite, testcase, authrequest);
                }
            }

            // send token request
            console.log("Token Request", tokenrequest);

            try {
                tokenresponse = await axios.post(
                    metadata.configuration.token_endpoint, 
                    tokenrequest, 
                    {headers: { 'Content-Type': 'application/json'}}
                );
                
            } catch(error) {
                console.log("Token Request ERROR", error.response.data);
                return res.status(400).json({
                    error: "Token Request ERROR",
                    error_message: error.response.data,
                    metadata: metadata,
                    authrequest: authrequest,
                    authresponse: authresponse,
                    tokenrequest: tokenrequest
                });
            }
        }

        console.log("Token Response", tokenresponse.data);
        
        {   // token response
            let hook = "token-response";

            let tests = config_test[testsuite].cases[testcase].hook[hook]; 
            let testcase_name = config_test[testsuite].cases[testcase].name;
            let testcase_description = config_test[testsuite].cases[testcase].description;
            let testcase_referements = config_test[testsuite].cases[testcase].ref;
            console.log("Test case name: " + testcase_name);
            console.log("Referements: " + testcase_referements);
            console.log("Test list to be executed: ", tests);

            for(let t in tests) {
                let TestTokenResponseClass = require("../../test/" + tests[t]);
                test = new TestTokenResponseClass(metadata, authrequest, authresponse, tokenrequest, tokenresponse);
                if(test.hook==hook) {
                    result = test.getResult();

                    switch(test.validation) {
                        case 'automatic':
                            switch(result.result) {
                                case 'success': num_success++; break;
                                case 'failure': num_failure++; break;
                            }
                        break;
                        case 'self': num_warning++; break;
                        case 'required': num_warning++; break;
                    }

                    // save single test to store
                    database.setTest(user, external_code, store_type, testsuite, testcase, hook, result);

                    console.log(result);
                    report.push(result);
                }
            }
        }

        let userinforequest = {};
        let userinforesponse = {};

        { // userinfo request
            let hook = "userinfo-request";

            let tests = config_test[testsuite].cases[testcase].hook[hook]; 
            let testcase_name = config_test[testsuite].cases[testcase].name;
            let testcase_description = config_test[testsuite].cases[testcase].description;
            let testcase_referements = config_test[testsuite].cases[testcase].ref;
            console.log("Test case name: " + testcase_name);
            console.log("Referements: " + testcase_referements);
            console.log("Test list to be executed: ", tests);

            let test = null;
            for(let t in tests) {
                let TestUserinfoRequestClass = require("../../test/" + tests[t]);
                test = new TestUserinfoRequestClass(metadata, authrequest, authresponse, tokenrequest, tokenresponse, userinforequest);
                if(test.hook==hook) {
                    userinforequest = await test.getResult();

                    switch(test.validation) {
                        case 'self': num_warning++; break;
                        case 'required': num_warning++; break;
                    }

                    // save request
                    //database.saveRequest(authrequest.state, user, store_type, testsuite, testcase, authrequest);
                }
            }

            // send userinfo request
            console.log("Userinfo Request", userinforequest);

            try {
                userinforesponse = await axios.post(
                    metadata.configuration.userinfo_endpoint, 
                    {}, 
                    {headers: userinforequest}
                );
                
            } catch(error) {
                console.log("Userinfo Request ERROR", error.response.data);
                return res.status(400).json({
                    error: "Userinfo Request ERROR",
                    error_message: error.response.data,
                    metadata: metadata,
                    authrequest: authrequest,
                    authresponse: authresponse,
                    tokenrequest: tokenrequest,
                    tokenresponse: tokenresponse.data,
                    userinforequest: userinforequest
                });
            }
        }

        console.log("Userinfo Response", userinforesponse.data);
        
        {   // userinfo response
            let hook = "userinfo-response";

            let tests = config_test[testsuite].cases[testcase].hook[hook]; 
            let testcase_name = config_test[testsuite].cases[testcase].name;
            let testcase_description = config_test[testsuite].cases[testcase].description;
            let testcase_referements = config_test[testsuite].cases[testcase].ref;
            console.log("Test case name: " + testcase_name);
            console.log("Referements: " + testcase_referements);
            console.log("Test list to be executed: ", tests);

            for(let t in tests) {
                let TestUserinfoResponseClass = require("../../test/" + tests[t]);
                test = new TestUserinfoResponseClass(metadata, authrequest, authresponse, tokenrequest, tokenresponse, userinforequest, userinforesponse);
                if(test.hook==hook) {
                    result = test.getResult();

                    switch(test.validation) {
                        case 'automatic':
                            switch(result.result) {
                                case 'success': num_success++; break;
                                case 'failure': num_failure++; break;
                            }
                        break;
                        case 'self': num_warning++; break;
                        case 'required': num_warning++; break;
                    }
                    
                    // save single test to store
                    database.setTest(user, external_code, store_type, testsuite, testcase, hook, result);

                    console.log(result);
                    report.push(result);
                }
            }
        }

        let summary_result = "";
        if(num_failure>0) {
            summary_result = "failure";
        } else if(num_warning>0) {
            summary_result = "warning";
        } else {
            summary_result = "success";
        }
        

        res.status(200).json({
            summary: {
                result: summary_result,
                num_success: num_success,
                num_warning: num_warning,
                num_failure: num_failure
            },
            details: {
                metadata: metadata,
                authrequest: authrequest,
                authresponse: authresponse,
                tokenrequest: tokenrequest,
                tokenresponse: tokenresponse.data,
                userinforequest: userinforequest,
                userinforesponse: userinforesponse.data,
                report: report,
                report_datetime: moment().format("YYYY-MM-DD HH:mm:ss")
            }
        });




        // make refresh request
        // send refresh request

        // get refresh response
        // assert refresh response

    });


}


/*

    HOOK

    metadata                        t = new TestMetadata(metadata); result = t.exec() 
    authentication-request          h = new AuthenticationRequestHook(data); request = h.exec()
    authentication-response         h = new AuthenticationResponseHook(response); result = h.exec();
    token-request                   
    token-response
    userinfo-request
    userinfo-response




*/