// https://bugs.chromium.org/p/chromium/issues/detail?id=527326
// https://bugs.chromium.org/p/chromium/issues/detail?id=487422#c19
// https://docs.google.com/document/d/1nEN0SqC1jEpHgKuQPrppwSabC8JRAuJb7MSTGCe2Pzg/edit#
// https://chromedevtools.github.io/devtools-protocol/tot/Network#type-RequestPattern

var API_VERSION=['1'];

var attached={};
var mem={};
var timer={};

function request_async(extid,msg) {
    return new Promise(function(resolve,reject) {
        chrome.runtime.sendMessage(extid,msg,{},resolve);
    });
}

function hash(extid,pattern) {
    pattern=pattern||[];
    return extid+'|'+pattern.map(encodeURI).join('|');
}

var client={};

function clear_mem(tabid) {
    delete attached[tabid];
    delete mem[tabid];
    delete timer[tabid];
}

function perform(tabid,details,extid) {
    if(attached[tabid]) return;
    var target={
        tabId: tabid
    };
    mem[tabid]=request_async(extid,{
        type: '9ALPHA_CALL',
        details: details
    });
    console.time('tab '+tabid);
    console.log('ATTACH',tabid);
    chrome.debugger.attach(target,'1.3',function() {
        chrome.debugger.sendCommand(target,'Network.enable',{},function() {});
        chrome.debugger.sendCommand(target,'Network.setRequestInterception',{patterns: [
            {urlPattern: details.url}
        ]},function() {
            console.log('ATTACH FINISHED');
            if(attached[tabid]==1)
                attached[tabid]=2;
        });
    });
    attached[tabid]=1;
    timer[tabid]=setTimeout(function() {
        chrome.debugger.detach(target);
        clear_mem(target.tabId);
    },500);
}

chrome.debugger.onEvent.addListener(function(src,method,params) {
    function good(response) {
        var continu={
            interceptionId: params.interceptionId,
        };
        var resp=response['encoded'] || (response['raw'] ? btoa(response['raw']) : undefined);
        if(resp!==undefined)
            continu.rawResponse=resp;
        chrome.debugger.sendCommand(src,'Network.continueInterceptedRequest',continu,function() {
            console.log('MOCKED',src.tabId);
            chrome.debugger.detach(src);
            clear_mem(src.tabId);
            console.timeEnd('tab '+src.tabId);
        });
    }
    
    function bad(e) {
        console.error(e);
        // go ahead
        chrome.debugger.sendCommand(src,'Network.continueInterceptedRequest',{
            interceptionId: params.interceptionId
        },function() {
            console.log('SKIPPED',src.tabId);
            chrome.debugger.detach(src);
            clear_mem(src.tabId);
            console.timeEnd('tab '+src.tabId);
        });
    }
    
    //console.log(method,params);
    if(method=='Network.requestIntercepted') {
        console.log('CATCHED',src.tabId,params);
        if(timer[src.tabId])
            clearTimeout(timer[src.tabId]);
        
        if(mem[src.tabId])
            mem[src.tabId].then(good).catch(bad);
        else
            bad(new Exception('no response'));
    }
});

function delay() {
    var s=(+new Date());
    while((+new Date())-s<20);
}

chrome.debugger.onDetach.addListener(function(src,reason) {
    console.log('DETACH',src.tabId,reason);
    clear_mem(src.tabId);
});

chrome.runtime.onMessageExternal.addListener(function(msg,sender,sendResponse) {
    if(msg.api_version && sender.id) {
        if(API_VERSION.indexOf(msg.api_version)==-1)
            return sendResponse({
                error: 'API_VERSION_NOT_SUPPORTED',
                supported_api_version: API_VERSION
            });
        console.log('connection from',sender.id);
        
        var exp=new RegExp(msg.match_pattern_re);
        var curhash=hash(sender.id,msg.match_pattern_filters);
        
        if(client[curhash]) {
            console.log('remove old listener');
            chrome.webRequest.onBeforeRequest.removeListener(client[curhash].callback,client[curhash].filter,['blocking']);
        }
        
        client[curhash]={
            callback: function(details) {
                if(details.tabId>0 && exp.exec(details.url)) {
                    console.log('REQUEST',details.tabId,details);
                    perform(details.tabId,details,sender.id);
                    delay();
                    if(attached[details.tabId]!=2)
                        return {
                            redirectUrl: details.url
                        };
                }
            },
            filter: {urls: msg.match_pattern_filters||['*://*/*']}
        }
        
        chrome.webRequest.onBeforeRequest.addListener(client[curhash].callback,client[curhash].filter,['blocking']);
        sendResponse({
            error: null
        });
    }
});
