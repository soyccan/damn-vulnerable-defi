const { tracer } = require("hardhat");

function setTracerTag(address, name) {
    console.log(`${name}: ${address}`);
    if (tracer) {
        tracer.nameTags[address] = name;
    }
}

async function waitForTx(promiseOfTxResp) {
    return await (await promiseOfTxResp).wait();
}

module.exports = {
    setTracerTag,
    waitForTx,
};
