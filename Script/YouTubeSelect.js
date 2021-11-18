
const isLoon = typeof $loon !== "undefined";
const isSurge = typeof $httpClient !== "undefined" && !isLoon;
const $ = Cache()

const BASE_URL = "https://www.youtube.com/premium"

const needRegion = $.read("youtube.need.region") ? "CN" : JSON.parse($.read("youtube.need.region"))
// let params = getParams($argument)
let youtubeGroup = $.read("youtube.policy") ? "YouTube" : $.read("youtube.policy")
let subProxies = []
var oldSubPolicy = ""
let subPolicyCache = $.read("youtube.result.cache") ? new Map() : JSON.parse($.read("youtube.result.cache"))
let preSatisfactionProxies = []

    ; (async () => {

        let subProxies = (await httpAPI("/v1/policy_groups"))[youtubeGroup];
        oldSubPolicy = (await httpAPI("/v1/policy_groups/select?group_name=" + encodeURIComponent(youtubeGroup) + "")).policy;
        let nowIndex = 0
        for (var key in subProxies) {
            if (subProxies[key].name === oldSubPolicy) {
                nowIndex = key
            }

            if (subPolicyCache.has(subProxies[key])) {
                preSatisfactionProxies.push(subProxies[key].name)
            } else {
                subProxies.push(subProxies[key].name)
            }
        }

        for (const proxy of preSatisfactionProxies) {
            if (selectProxy(proxy)) {
                $done({
                    title: "YouTube Selected",
                    content: "当前节点 " + needRegion.toUpperCase + " :" + proxy
                })
                return
            }
        }

        for (const proxy of subProxies) {
            if (selectProxy(proxy)) {
                $done({
                    title: "YouTube Selected",
                    content: "当前节点 " + needRegion.toUpperCase + " :" + proxy
                })
                return
            }
        }


        setPolicy(youtubeGroup, oldSubPolicy)

        clearCache()

        $done({
            title: "YouTube Selected",
            content: "当前节点：" + oldSubPolicy
        })

    })()

function clearCache() {
    let now = (new Date()).valueOf()
    for (const [key, value] of subPolicyCache) {
        if (value.time - now > 30 * 60 * 60 * 24) {
            subPolicyCache.delete(key)
        }
    }
}
function selectProxy(subProxy) {
    setPolicy(youtubeGroup, subProxy)
    try {
        let region = await Promise.race([test(), timeout(3000)])
        console.log(region)
        if (region === needRegion) {
            subPolicyCache.set(subProxy, { region: needRegion, timestamp: (new Date()).valueOf() })
            return true
        }

        console.log("skip" + subProxy)
    } catch (error) {
        console.log(error)
    }

    return false
}

function test() {
    return new Promise((resolve, reject) => {
        let option = {
            url: BASE_URL,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
                'Accept-Language': 'en',
            },
        }
        $httpClient.get(option, function (error, response, data) {
            if (error != null || response.status !== 200) {
                reject('Error')
                return
            }


            let region = getRegion(data);

            resolve(region.toUpperCase())
        })
    })
}



function getRegion(data) {
    let region = "";

    if (data.indexOf('www.google.cn') !== -1 && data.indexOf('Premium is not available in your country') !== -1) {
        region = "CN";
    } else {
        let re = new RegExp('"countryCode":"(.*?)"', "gm");
        let result = re.exec(data);
        if (result != null && result.length === 2) {
            region = result[1];
        } else {
            region = "US";
        }
    }

    return region;
}

function timeout(delay = 5000) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject('Timeout')
        }, delay)
    })
}

function httpAPI(path = "", method = "GET", body = null) {
    return new Promise((resolve) => {
        $httpAPI(method, path, body, (result) => {
            resolve(result);
        });
    });
};

function setPolicy(policy, subProxies) {
    console.log(policy + "->" + subProxies)
    if (isSurge) {
        $surge.setSelectGroupPolicy(policy, subProxies)
    } else if (isLoon) {
        $config.setSelectPolicy(policy, subProxies);
    }
}

function Cache() {
    return {
        read: function (name) {
            if (isSurge || isLoon) {
                $persistentStore.read(name)
            }
        },
        write: function (name, value) {
            if (isSurge || isLoon) {
                $persistentStore.write(value, name)
            }
        }
    }
}