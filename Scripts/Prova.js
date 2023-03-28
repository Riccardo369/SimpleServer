const CryptoJS = require('crypto-js');
const fastify = require('fastify')();
const fs = require('fs');
const jwt = require('jsonwebtoken');
const AsyncLock = require('async-lock');

const promise = Promise;

const PromiseObject = new Promise((resolve, reject) => {

    var e = 2;

    if(e <= 2) resolve("Risultato pulito");
    else reject("Risultato sporco");

});

async function PromiseExample() {

    let value;

    try { 
        value = await PromiseObject; 
        console.log("Promise resolve: "+value);
    }
    catch (error) { value = undefined; }

    return value;
}


console.log(PromiseExample());

