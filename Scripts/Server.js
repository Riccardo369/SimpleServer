//Librerie
const CryptoJS = require('crypto-js');
const fastify = require('fastify')();
const fs = require('fs');
const jwt = require('jsonwebtoken');
const AsyncLock = require('async-lock');

//Oggetto che blocca e sblocca un singolo thread alla volta
const lock = new AsyncLock();

var AccountByToken;

//Trasformo una stringa nel suo hash attraverso la conversione SHA256
function SHA256Encode(text){
  return CryptoJS.SHA256(text).toString();
} 

//Trasformo una stringa in UTF-8 in base 64
function UTF8ToBase64(text){
  return btoa(text);
}

//Trasformo una stringa in base 64 in UTF-8
function Base64toUTF8(text){
  return atob(text);
}

/*Il JWT è un "gettone", creato dal server e salvato dal client, così ogni volta che il client e server comunicano, sanno che
non ci sono state interferenze durante il trasporto dei pacchetti dati. Un token viene usato quando un utente effettua l'
accesso

Un token JWT è formato da 3 parti, unite da un punto (PrimaParte.SecondaParte.TerzaParte):
Header: contiene informazioni sul tipo di token e l'algoritmo di hashing utilizzato per firmare il token.
Payload: contiene le informazioni utente (ad esempio l'ID utente) o qualsiasi altra informazione necessaria per l'applicazione.
Signature: contiene la firma del token per verificare che il mittente sia valido.

Con gli stessi parametri, stessa chiave e stessi opzioni, l' header non cambia mai, il payload e signature cambiano sempre, ad ogni run del processo
(lo stesso processo crea sempre lo stesso token con gli stessi parametri)
*/
function CreateJWT(Email, Password){

  //I parametri inseriti in ordine sono: i dati, la stringa che forma la chiave e le opzioni
  return jwt.sign({email: Email, password: Password}, 'mySecretKey', {expiresIn: "30m"});
  
}

/*Questa funzione si occupa di controllare se esiste un file di quell' account con quella key. Ridà un risultato booleano, che dice se esiste
un dato con quella key di quell' account.
*/
async function ValidKey(Account, Key){

  var Result = false;;

  await lock.acquire('mutex', async () => {

    fs.stat("JSON set/Data/"+Account+"/"+Key, (err) => {
      if(err) Result = true;
    });

  });

  return Result;

}

//Funzione che ridà la condizione che il token sia ancora valido o no
async function ValidToken(Token){

  //Ottengo il TimeStamp attuale
  let TimeNow;
  await lock.acquire('mutex', async () => { TimeNow = new Date().getTime(); });

  //Decodifico il token e gli prendo la data di scadenza. Essendo che mancano i secondi, paragonandoli al tempo attuale, gli aggiungo 3 zeri
  const ExpToken = parseInt(jwt.decode(token).exp.toString()+"000");

  //Ridò la condizione di ritorno (se il token non è ancora scaduto)
  return ExpToken >= TimeNow;

}

//Controlla se esiste un account con questa email
async function CheckAccount(email){

  let Result = false;

  await lock.acquire('mutex', async () => {

    fs.stat('JSON set/Accounts/'+email, (err, stats) => {
      if(err) Result = true;
    });

  });

  return Result;

}

//Chiamata
/*Funzione che ridà l' email dell' account. Se ridà:
Range Error = Il token è scaduto
Internal Error = Non esiste nessun account con questo token*/
async function LoginByToken(token){

  //Se il token è scaduto ridò una stringa
  if(await ValidToken(token)){
    res.status(403).send("Il token è scaduto");
    throw new RangeError("Il token è scaduto");
  }

  //Trovo l' account che mi serve
  AccountByToken = ActualTokens[token];

  //Se non ho trovato l' account dal dizionario, o non esiste proprio quell' account ridò una stringa vuota
  if(AccountByToken === undefined || !(await CheckAccount(AccountByToken))){
    res.status(403).send("Nessun account autenticato con questo token");
    throw new InternalError("Nessun account autenticato con questo token");
  }

}

//Chiamata
//Funzione che si occupa di fare un back-up dei tokens in modo asincrono ciclicamente (dopo tot tempo)
async function TokensBackUp(){

  let Data;
  var Completed = true;
  await lock.acquire('mutex', async () => { 
    fs.writeFile("JSON set/TokensBackUp.json", JSON.stringify(ActualTokens), (err) => {
      if(err) Completed = false;
    }); 
  });

  throw new InternalError("Il back up dei token non è riuscito");

}

//Chiamata
//Funzione che si occupa di cancellare i dati residui
//Se c'è una cartella che non si è riusciti a cancellare, lancia un errore
async function ClearData(){

  var Error;

  var Lista = DataToDelete.slice();

  for(let i=0; i<Lista.length; i++){

    Error = false;

    //Cancello la cartella dell' account ormai cancellato in questione
    fs.rmdir("JSON set/Data/"+Lista[i], { recursive: true }, (err) => { if(err) Error = true; }); 

    //Se non c' è un errore, cancello dalla lista dei dati da cancellare ed esco, altrimenti esco con un errore
    if(Error) throw new InternalError("Errore nell' eliminazione dei dati residui");
    else await lock.acquire('mutex', async () => { DataToDelete.splice(Lista[i], 1); });

  }
}

//Chiamata
//Funzione che crea i file e le cartelle che fanno da base per le funzionalità del server
function CreateServer(){

  const Dict = {}

  var Result = true;

  fs.mkdir("JSON set", (err) => { if (err) Result = false; });
  if(!Result) return false;
  fs.mkdir("JSON set/Accounts", (err) => { if (err) Result = false; });
  if(!Result) return false;
  fs.mkdir("JSON set/Data", (err) => { if (err) Result = false; });
  if(!Result) return false;
  fs.writeFile("JSON set/TokensBackUp.json", JSON.stringify(Dict), (err) =>{ Result = false; } );

  return Result;
}

//Chiamata
/*Funzione che carica i Tokens già esistenti nel caso in cui il server dovesse spegnersi e riaccendersi 
per molti motivi(caduta di corrente, manutenzione, etc.).*/
function LoadTokens(){

  var Result = true;

  fs.readFile('JSON set/TokensBackUp.json', (err, data) => {
    
    if(!err) ActualTokens = JSON.parse(data.toString());
    Result = !err;
    
  });

  return Result;
}

//Mi segno i token presenti
var ActualTokens = {};

//Mi segno i dati da cancellare
var DataToDelete = [];

// Gestione della richiesta POST/register  -  Registra un nuovo utente    
fastify.route({

  method: "POST",
  path: "/register",
  handler: async (req, res) => {

    const { email, password } = req.body;

    //Ridò un errore di sintassi
    if(email === "" || password === ""){
      res.status(400).send('La tua email e la tua password devono essere entrambe riempite');
      return;
    }

    //Se l' account non esiste
    if(!(await CheckAccount(email))){
      res.status(403).send('Il tuo account è già presente');
      return;
    }

    /*Se l' account non esiste ma esistono ancora i dati residui del suo predecessore (con la stessa email), ridò un errore,
    perchè devo ancora eliminarli*/
    if(DataToDelete.includes(email)){
      res.status(500).send('Non possiamo ancora creare il tuo account, le tue credenziali però sono accettate');
      return;
    }

    //Creo il nuovo account
    const data = {

      email: email,
      password: SHA256Encode(password)

    };
    
    const NewData = JSON.stringify(data);

    await lock.acquire('mutex', async () => {
    
      fs.writeFile("JSON set/Accounts/"+email+".json", NewData, (error) => {

        if(error) res.status(500).send('Si è verificato un errore durante la registrazione del tuo account');
        else res.status(200).send('Account registrato');

      });

    });

  }

});

// Gestione della richiesta POST/login  -  Effettua login e riceve in risposta il JWT
fastify.route({

  method: "POST",
  path: "/login",
  handler: async(req, res) => {

    const { email, password } = req.body;

    //Se non è stato trovato il file dell' account
    if(!(await CheckAccount(email))){
      res.status(404).send('Il tuo account non esiste');
      return;
    }

    let Data;

    var Error = false;

    await lock.acquire('mutex', async () => {

      //Leggo il file dell' account
      fs.readFile("JSON set/Accounts/"+email+".json", 'utf8', (err, data) => { 
        if(err) Error = true; 
        else Data = data;
      });

    });

    if(Error){
      res.status(500).send('Si è verificato un errore durante la verifica di compatibilità delle credenziali');
      return;
    }

    //Estraggo i dati dal file JSON per comparare la password
    Data = JSON.parse(data);
    if(Data.password !== SHA256Encode(password)){
      res.status(403).send('Credenziali errate');
      return;
    }

    //Ritorna ok ed invia anche il JWT
    else {

      //Creo il token
      const Token = CreateJWT(email, Data.password);

      //Mi prendo l' email
      ActualTokens.Token = email;

      //Setto il token nell' header "Authorization"
      res.setHeader('Authorization', "Bearer "+Token);

      //Invio la risposta
      res.status(200).send("Account riconosciuto");
      return;

    }

  }

});

//Gestione della richiesta *DELETE/delete  -  Elimina l’utente attualmente loggato
fastify.route({

  method: "DELETE",
  path: "/delete",
  handler: async(req, res) => {

    //Tiro fuori il mio token
    var Token = req.header('Authorization').replace('Bearer ', '');

    let Account;

    //Ottengo il mio account attraverso l' autenticazione "veloce"
    try{

      await lock.acquire('mutex', async () => {
        await LoginByToken(Token);
        Account = AccountByToken;
      });

    }

    catch(err){ return; }

    var Error = false;
    var Email;
    var Password;

    //Leggo i dati che mi serviranno per un eventuale rollback
    await lock.acquire('mutex', async () => { 

      fs.readFile("JSON set/Accounts/"+Account+".json", (err, data) => {

        if(err) Error = true;

        else{

          const Dict = JSON.parse(data.toString());

          Email = Dict.email;
          Password = Dict.Password;
        }

      });

    });

    if(Error){
      res.status(500).send("Errore durante l' eliminazione del tuo account");
      return;
    }

    await lock.acquire('mutex', async () => { 

      //Cancello l' account
      fs.unlink("JSON set/Accounts/"+Account+".json", (err) => {
        if(err) Error = true;
      });

    });

    if(Error){
      res.status(500).send("Errore durante l' eliminazione del tuo account");
      return;
    }

    await lock.acquire('mutex', async () => { 

      //Cancello i dati salvati dall' account
      fs.rmdir("JSON set/Data/"+Account, { recursive: true }, (err) => {
        if(err) Error = true;
      });

    });

    if(Error){

      await lock.acquire('mutex', async () => { 

        //Cerco di fare il rollback dell' account. Se non il rollback non viene, ci pensa la funzione ClearData a pulire i dati
        fs.writeFile("JSON set/Accounts/"+Account+".json", JSON.stringify({email: Email, password: Password}), (err) => {
          if(err) DataToDelete.push(Account);  
        });

      });

    }

    //Cancello il token dell' account dal dizionario
    delete ActualTokens.Token;

    //Tutto ok
    res.status(200).send("Il tuo account è stato eliminato con successo");
    return;

  }
  
});

//Gestione della richiesta *POST/data  -  Carica dei dati nuovi
fastify.route({

  method: "POST",
  path: "/data",
  handler: async(req, res) => {

    const Data = req.params.data;
    const Key = req.params.key;

    //Tiro fuori il mio token
    var Token = req.header('Authorization').replace('Bearer ', '');

    let Account;

    //Ottengo il mio account attraverso l' autenticazione "veloce"
    try{

      await lock.acquire('mutex', async () => {
        await LoginByToken(Token);
        Account = AccountByToken;
      });

    }

    catch(err){ return; }

    //Se esiste già la chiave, ridò errore
    if(!(await ValidKey(Account, Key))){
      res.status(403).send("Esiste già un dato con quella chiave");
      return;
    }

    await lock.acquire("mutex", async () => {

      //Gestisci la richiesta POST/data
      fs.writeFile("JSON set/Data/"+Account+"/"+Key, Data, (err) => {

        if(err) res.status(500).send("Problemi interni durante la creazione del tuo nuovo file");
        else res.status(200).send("Il tuo dato è stato creato con successo");

      });

    });

  }

});

//Gestione della richiesta *GET/data/:key  -  Ritorna i dati corrispondenti alla chiave   (FINIRE)
fastify.route({

  method: "GET",
  path: "/data/:key",
  handler: async(req, res) => {

    const key = req.params.key;

    //Tiro fuori il mio token
    var Token = req.header('Authorization').replace('Bearer ', '');

    let Account;

    //Ottengo il mio account attraverso l' autenticazione "veloce"
    try{

      await lock.acquire('mutex', async () => {
        await LoginByToken(Token);
        Account = AccountByToken;
      });

    }

    catch(err){ return; }

    //Gestisci la richiesta GET/data/:key

    //Se esiste già la chiave
    if(!(await ValidKey(Account, Key))){
      res.status(404).send("Non esiste un dato con quella chiave");
      return;
    }

    await lock.acquire('mutex', async () => {

      //Tiro fuori il valore del dato
      fs.readFile('JSON set/Data/'+Account+"/"+Key, (err, data) => {

        if(err) res.status(500).send("Errore interno nel prelevare il tuo dato");

        else{

          //Invio il valore al client (FARE)


          res.status(200).send(data.toString());
        }
        
      });

    });

  }

});

//Gestione della richiesta *PATCH/data/:key  -  Aggiorna i dati corrispondenti alla chiave
fastify.route({

  method: "PATCH",
  path: "/data/:key",
  handler: async(req, res) => {

    const Data = req.params.data;
    const Key = req.params.key;

    //Tiro fuori il mio token
    var Token = req.header('Authorization').replace('Bearer ', '');

    let Account;

    //Ottengo il mio account attraverso l' autenticazione "veloce"
    try{

      await lock.acquire('mutex', async () => {
        await LoginByToken(Token);
        Account = AccountByToken;
      });

    }

    catch(err){ return; }

    //Se non esiste ancora la chiave, ridò errore
    if(!(await ValidKey(Account, Key))){
      res.status(404).send("Non esiste ancora un dato con quella chiave");
      return;
    }

    await lock.acquire('mutex', async () => {

      //Gestisci la richiesta PATCH/data/:key
      fs.writeFile("JSON set/Data/"+Account+"/"+Key, Data, (err) => {

        if(err) res.status(500).send("Problemi interni durante l' aggiornamento del tuo dato");
        else res.status(200).send("Il tuo dato è stato aggiornato con successo");

      });

    });

  }
  
});

//Gestione della richiesta *DELETE/data/:key  -  Elimina i dati corrispondenti alla chiave
fastify.route({

  method: "DELETE",
  path: "/data/:key",
  handler:async(req, res) => {

    const key = req.params.key;

    //Tiro fuori il mio token
    var Token = req.header('Authorization').replace('Bearer ', '');

    let Account;

    //Ottengo il mio account attraverso l' autenticazione "veloce"
    try{

      await lock.acquire('mutex', async () => {
        await LoginByToken(Token);
        Account = AccountByToken;
      });

    }

    catch(err){ return; }

    //Se non esiste ancora la chiave, ridò errore
    if(!(await ValidKey(Account, Key))){
      res.status(404).send("Non esiste ancora un dato con quella chiave");
      return;
    }

    await lock.acquire('mutex', async () => {

      //Gestisci la richiesta DELETE/data/:key
      fs.unlink("JSON set/Data/"+Account+"/"+Key, (err) => {

        if(err) res.status(500).send("Errore durante l' eliminazione del tuo dato");
        else res.status(200).send("Eliminazione del tuo dato eseguita correttamente");

      });

    });

  }

});

//Tutto sequenziale (il server non è ancora partito)

console.log("Creazione cartelle e file per il server");

//Creo le cartelle che mi servono per il server
while(!CreateServer()){ console.log("Tentativo di creazione server fallito"); }

console.log("Caricamento dei JWT del server");

//Carico i JWT
while(!LoadTokens()){ console.log("Tentativo di caricamento dei JWT fallito"); }

console.log(!CheckAccount("eee"));

//Tutto asincrono (il server è partito)

//Apro la porta di ascolto
/*fastify.listen(3000, function(err, addr) {
  if(err) console.error("Errore, il server non parte: "+err);
  else console.log(`Server in ascolto su `+addr);
});*/