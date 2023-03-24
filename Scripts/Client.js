//SHA-256

//Node.js
/* const CryptoJS = require('crypto-js');
var hash = CryptoJS.SHA256("This works").toString();
console.log(hash);  */

//Browser
 /*  async function  getSHA256Hash(input){

    const textAsBuffer = new TextEncoder().encode(input);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", textAsBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((item) => item.toString(16).padStart(2, "0")).join("");

    //console.log(hash);

    return hash;

  };

var text = getSHA256Hash("This works")
.then(result => { 
    return result.toString();
})
.catch(error => { return null; });

console.log(text); */

 
/* let xhr = new XMLHttpRequest();

function Richiesta(){

    //xhr = new XMLHttpRequest();
    xhr.open("POST", "http://127.0.0.1:3000/");
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Content-Type", "application/json");

     xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            console.log(xhr.status);
            console.log(xhr.responseText);
        }}; 

    let data = `{
    "Id": 78912,
    "Customer": "Jason Sweet",
    "Quantity": 1,
    "Price": 18.00
    }`;

    xhr.send(data);

    console.log(xhr.readyState);
    console.log(xhr.status);
    console.log(xhr.responseText); 

}

//var xhr = new XMLHttpRequest();
xhr.open("GET", "http://localhost:3000/data", true);

xhr.onreadystatechange = function() {
  if (this.readyState === 4 && this.status === 200) {
    var data = JSON.parse(this.responseText);
    console.log(data);
  }
};

xhr.setRequestHeader("Access-Control-Allow-Origin", "*");

xhr.send();

//for(let i=0; i<6; i++){ Richiesta(); }  */