var ID_9ALPHA='mpmelhaodpblhamagflokmobogmojjpd';

setTimeout(function() { // after 9alpha is initialized
    chrome.runtime.sendMessage(ID_9ALPHA,{
        api_version: '1',
        match_pattern_filters: ['*://s.xmcp.ml/*'],
        match_pattern_re: '^https?://s\\.xmcp\\.ml/[0-9]+$'
    },{},function(res) {
        if(!res || res.error)
            console.error(res);
        else
            console.log('9alpha connected');
    });
},300);

chrome.runtime.onMessageExternal.addListener(function(msg,sender,sendResponse) {
    if(sender.id==ID_9ALPHA && msg.type=='9ALPHA_CALL') {
        console.log(msg.details);
        var url=msg.details.url;
        sendResponse({
            raw: 'HTTP/1.1 200 OKAY\r\nContent-Type: text/plain\r\n\r\nmocked response for url: '+url
        });
    }
});