const fs = require('fs');

async function A(){

    var Result;

    await fs.access("JSON set/Accounts/email1.json", (err) => { 
        
        if(err){
            
        console.log("Il file non esiste");
        Result = false;
        return false;
        }

        else{

        console.log("Il file esiste");
        Result = true;
        return true;

        }
    });

    console.log()

    return Result;

}


console.log(A());