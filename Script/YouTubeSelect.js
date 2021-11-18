
const isLoon = typeof $loon !== "undefined";
const isSurge = typeof $httpClient !== "undefined" && !isLoon;
const $ = Cache()

const BASE_URL = "https://www.youtube.com/premium"
let config = {
    region: "CN",
    policy: "YouTube"
}

let boxConfig = $.read("youtube")
if (boxConfig != "" && typeof boxConfig != "undefined") {
    config = JSON.parse(boxConfig)
}

const needRegion = config.region
// let params = getParams($argument)
let youtubeGroup = config.policy
let otherSubProxies = []
var oldSubPolicy = ""
let subPolicyCache = new Map(Object.entries(config.cache === undefined ? {} : config.cache))
console.log(subPolicyCache)
let preSatisfactionProxies = []

    ; (async () => {
        let subProxies = []
        if (isLoon) {
            subProxies = $config.getSubPolicys(youtubeGroup)
        } else if (isSurge) {
            subProxies = (await httpAPI("/v1/policy_groups"))[youtubeGroup];
            oldSubPolicy = (await httpAPI("/v1/policy_groups/select?group_name=" + encodeURIComponent(youtubeGroup) + "")).policy;
        }

        let nowIndex = 0
        for (var key in subProxies) {
            if (subProxies[key].name === oldSubPolicy) {
                nowIndex = key
            }

            if (subPolicyCache.has(subProxies[key].name)) {
                let name = subProxies[key].name
                console.log("cache sub proxy:[" + name + "]")
                preSatisfactionProxies.push(name)
            } else {
                let name = subProxies[key].name
                console.log("other sub proxy:[" + name + "]")
                otherSubProxies.push(name)
            }
        }

        for (const proxy of preSatisfactionProxies) {
            let testResult = await selectProxy(proxy)
            if (testResult === true) {
                handleCache()
                $done({
                    title: "YouTube Selected",
                    content: "当前节点 " + needRegion.toUpperCase() + " :" + proxy
                })
                return
            }
        }

        for (const proxy of otherSubProxies) {
            let testResult = await selectProxy(proxy)
            if (testResult === true) {
                handleCache()
                $done({
                    title: "YouTube Selected",
                    content: "当前节点 " + needRegion.toUpperCase() + " :" + proxy
                })
                return
            }
        }


        setPolicy(youtubeGroup, oldSubPolicy)

        handleCache()
        $done({
            title: "YouTube Selected",
            content: "当前节点：" + oldSubPolicy
        })

    })()

function handleCache() {
    let now = (new Date()).valueOf()

    for (const [key, value] of subPolicyCache) {
        console.log(value.region + " " + value.timestamp)
        console.log(now)
        if (value.region !== needRegion || now - value.timestamp > 30 * 60 * 60 * 24) {
            subPolicyCache.delete(key)
        }
    }

    config.cache = Object.fromEntries(subPolicyCache.entries())
    $.write("youtube", JSON.stringify(config))
}

async function selectProxy(subProxy) {
    setPolicy(youtubeGroup, subProxy)
    try {
        let region = await Promise.race([test(subProxy), timeout(3000)])
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

function test(nodeName) {
    return new Promise((resolve, reject) => {
        let option = {
            url: BASE_URL,
            node: nodeName,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
                'Accept-Language': 'en',
            }
        }

        $httpClient.get(option, function (error, response, data) {
            if (error != null || response.status !== 200) {
                reject('Error')
                return
            }

            let region = getRegion(data);
            console.log(region)

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
                return $persistentStore.read(name)
            }
        },
        write: function (name, value) {
            if (isSurge || isLoon) {
                $persistentStore.write(value, name)
            }
        }
    }
}
