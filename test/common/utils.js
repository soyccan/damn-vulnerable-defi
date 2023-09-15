const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const path = require("node:path");

const { tracer } = require("hardhat");
const { parseFullyQualifiedName } = require("hardhat/utils/contract-names");

const setTracerTag = (address, name) => {
    console.log(`${address}: ${name}`);
    if (!tracer)
        return;

    tracer.nameTags[address] = name;
}

const setTracerArtifactName = async (address, name) => {
    console.log(`${address} => ${name}`);
    if (!tracer)
        return;

    let { sourceName, contractName } = parseFullyQualifiedName(name);
    setTracerTag(address, contractName);
    tracer.artifactNames[address] = name;

    // if artifact not exist, try to copy from node_modules
    let artifactPath = hre.artifacts.formArtifactPathFromFullyQualifiedName(name);
    if (fs.existsSync(artifactPath))
        return;

    // Example:
    //   name: "@uniswap/v3-core/contracts/UniswapV3Factory.sol:UniswapV3Factory"
    //   sourceName: "@uniswap/v3-core/contracts/UniswapV3Factory"
    //   contractName: "UniswapV3Factory"
    //   moduleName: "@uniswap/v3-core"
    //   modulePath: "contracts/UniswapV3Factory.sol"
    //   srcArtifactPath: "node_modules/@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"
    //   artifactPath: "artifacts/@uniswap/v3-core/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"
    let sourceNameSplits = sourceName.split("/");

    let moduleName = sourceNameSplits.shift();
    if (moduleName.startsWith("@"))
        moduleName = path.join(moduleName, sourceNameSplits.shift());

    let modulePath = sourceNameSplits.join("/");
    let srcArtifactPath = path.join(
        process.cwd(),
        "node_modules",
        moduleName,
        "artifacts",
        modulePath,
        `${contractName}.json`
    );
    await copyFileEnsureDir(srcArtifactPath, artifactPath);
}

const waitForTx = async promiseOfTxResp => await (await promiseOfTxResp).wait();

const copyFileEnsureDir = async (src, dest) => {
    try {
        await fsPromises.mkdir(path.dirname(dest), { recursive: true });
    } catch (err) {
        if (err.code !== "EEXIST")
            throw err;
    }
    await fsPromises.copyFile(src, dest);
}

module.exports = {
    setTracerTag,
    setTracerArtifactName,
    waitForTx,
    copyFileEnsureDir,
};
