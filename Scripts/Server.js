//Librerie
const CryptoJS = require('crypto-js');
const fastify = require('fastify')();
const fs = require('fs');
const jwt = require('jsonwebtoken');
const AsyncLock = require('async-lock');

//Oggetto che blocca e sblocca un singolo thread alla volta
const lock = new AsyncLock();

//Variabile usata da "rimbalzo" per la funzione "LoginByToken"
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

  try{
    fs.statSync("JSON set/Data/"+Account+"/"+Key+".txt");
    return true;
  }

  catch(err) { return false; }

}

//Funzione che ridà la condizione che il token sia ancora valido o no
async function ValidToken(Token){

  //Ottengo il TimeStamp attuale
  let TimeNow = new Date().getTime(); 

  //Decodifico il token e gli prendo la data di scadenza. Essendo che mancano i secondi, paragonandoli al tempo attuale, gli aggiungo 3 zeri
  const ExpToken = parseInt(jwt.decode(Token).exp.toString()+"000");

  //Ridò la condizione di ritorno (se il token non è ancora scaduto)
  return ExpToken >= TimeNow;

}

//Controlla se esiste un account con questa email
async function CheckAccount(email){

  try{
    fs.accessSync("JSON set/Accounts/"+email+".json");
    return true;
  }
  catch(err) { return false; }

}

//Chiamata
/*Funzione che ridà l' email dell' account. Se ridà:
Range Error = Il token è scaduto
Internal Error = Non esiste nessun account con questo token*/
async function LoginByToken(token){

  //Se il token è scaduto ridò una stringa
  if(!(await ValidToken(token))) throw new RangeError("Il token è scaduto");

  //Trovo l' account che mi serve
  AccountByToken = ActualTokens[token];

  //Se non ho trovato l' account dal dizionario, o non esiste proprio quell' account ridò una stringa vuota
  if(AccountByToken === undefined || !(await CheckAccount(AccountByToken))) throw new InternalError("Nessun account autenticato con questo token");

}

//Chiamata
//Funzione che si occupa di fare un back-up dei tokens in modo asincrono ciclicamente (dopo tot tempo)   (Da rivedere)
async function TokensBackUp(){

  console.log("Back up tokens");

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
//Funzione che si occupa di cancellare i dati residui ciclicamente
//Se c'è una cartella che non si è riusciti a cancellare, lancia un errore
async function ClearData(){

  console.log("Clear data");

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

//Funzione che cancella i dati residui ancor prima che parte il server, prepara già la lista dei dati da cancellare
async function StartClearData(){

  try{

    //Mi prendo la lista delle cartelle ancora presenti
    const Dati = fs.readdirSync("JSON set/Data");

    //Per ogni cartella di dati
    for(let i=0; i<Dati.length; i++){

      //Se non esiste più quell' account, cancello la cartella di file
      if(!(await CheckAccount(Dati[i]))){

        //Se è andato tutto bene vado avanti
        try{ fs.unlinkSync("JSON set/Data/"+Dati[i]+".json"); }

        //Altrimenti aggiungo il nome alla lista delle cartelle di file da cancellare
        catch(err) { DataToDelete.push(Dati[i]); }
 
      }
    }

  }
  catch(err) {}

}

//Mi segno i token presenti
var ActualTokens = {};

//Mi segno i dati da cancellare
var DataToDelete = [];

// Gestione della richiesta POST/register  -  Registra un nuovo utente       Testato   
fastify.route({

  method: "POST",
  path: "/register",
  handler: async (req, res) => {

    console.log("Richiesta POST/register");

    const email = req.query["email"];
    const password = req.query["password"];

    //Ridò un errore di sintassi
    if(email === "" || password === ""){
      res.status(400).send('La tua email e la tua password devono essere entrambe riempite');
      return;
    }

    //Se l' account già esiste
    if(await CheckAccount(email)){
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

      try{
        fs.mkdirSync("JSON set/Data/"+email);
        fs.writeFileSync("JSON set/Accounts/"+email+".json", NewData);
        
        res.status(200).send("Account registrato");
      }
      catch(err){

        res.status(500).send('Si è verificato un errore durante la registrazione del tuo account'); }

    });

    console.log("Account creato");

  }

});

// Gestione della richiesta POST/login  -  Effettua login e riceve in risposta il JWT      Testato
fastify.route({

  method: "POST",
  path: "/login",
  handler: async(req, res) => {

    console.log("Richiesta POST/login");

    const email = req.query["email"];
    const password = req.query["password"];

    //Se non è stato trovato il file dell' account
    if(!(await CheckAccount(email))){
      res.status(404).send('Il tuo account non esiste');
      return;
    }

    var Data;

    var Error = false;

    await lock.acquire('mutex', async () => {

      try{ Data = fs.readFileSync("JSON set/Accounts/"+email+".json", 'utf8'); }
      catch(err) { Error = true; }

    });

    if(Error){
      res.status(500).send('Si è verificato un errore durante la verifica di compatibilità delle credenziali');
      return;
    }

    //Estraggo i dati dal file JSON per comparare la password
    Data = JSON.parse(Data);

    if(Data.password !== SHA256Encode(password)){
      res.status(403).send('Credenziali errate');
      return;
    }

    //Ritorna ok ed invia anche il JWT
    else {

      //Creo il token
      const Token = CreateJWT(email, Data.password);

      //Aggiungo il token all' account
      ActualTokens[Token] = email;

      //Setto il token nell' header "Authorization"
      res.header('Authorization', Token);

      //Invio la risposta
      res.status(200).send("Account riconosciuto");
      return;

    }

  }

});

//Gestione della richiesta *DELETE/delete  -  Elimina l’utente attualmente loggato       Testato      -     Testato User agent
fastify.route({

  method: "DELETE",
  path: "/delete",
  handler: async(req, res) => {

    console.log("Richiesta DELETE/delete");

    //Tiro fuori il mio token
    var Token = req.headers.authorization;

    let Account;

    //Richiesta fatta dall' super utente
    if(req.headers["user-agent"] !== "") Account = req.headers["user-agent"];

    else{

      //Ottengo il mio account attraverso l' autenticazione "veloce"
      try{

        await lock.acquire('mutex', async () => {
          await LoginByToken(Token);
          Account = AccountByToken;
        });

      }

      catch(err){
        res.status(403).send("Il token è scaduto o non è stato autenticato nessun account con questo token"); 
        return;
      }

    }

    var Email;
    var Password;

    //Leggo i dati che mi serviranno per un eventuale rollback
    try{
      const Dict = JSON.parse(fs.readFileSync("JSON set/Accounts/"+Account+".json").toString());
      Email = Dict["email"];
      Password = Dict["password"];
    }
    catch(err) { 
      res.status(500).send("Errore durante l' eliminazione del tuo account");
      return;
    }

    const path = "JSON set/Accounts/"+Account+".json";

    console.log(path);

    //Cancello l' account
    try{ fs.unlinkSync(path); }
    catch(err) { 
      res.status(500).send("Errore durante l' eliminazione del tuo account");
      return;
    }

    //Cancello la cartella
    try{ fs.rmSync("JSON set/Data/"+Account, {recursive: true }); }
    catch(err){

      //Faccio il rollback nel caso in cui non riesco a cancellare la cartella
      try{ fs.writeFileSync("JSON set/Accounts/"+Account+".json", JSON.stringify({email: Email, password: Password})); }
      catch(err){ DataToDelete.push(Account); }

    }

    //Cancello il token dell' account dal dizionario
    delete ActualTokens[Token];

    //console.log("Acccount "+Account+" eliminato");

    res.status(200).send("Il tuo account è stato eliminato con successo");
    return;

  }
  
});

//Gestione della richiesta *POST/data  -  Carica dei dati nuovi          Testato        -      Testato User agent   
fastify.route({

  method: "POST",
  path: "/data",
  handler: async(req, res) => {

    console.log("Richiesta POST/data");

    const Data = req.query["value"];
    const Key = req.query["key"];

    //Tiro fuori il mio token
    var Token = req.headers.authorization;

    let Account;

    //Richiesta fatta dall' super utente
    if(req.headers["user-agent"] !== "") Account = req.headers["user-agent"];
  
    else{

      //Ottengo il mio account attraverso l' autenticazione "veloce"
      try{

        await lock.acquire('mutex', async () => {
          await LoginByToken(Token);
          Account = AccountByToken;
        });

      }

      catch(err){
        res.status(403).send("Autenticazione attraverso il token fallita");
        return;
      }

    }

    //Se esiste già la chiave, ridò errore
    if(await ValidKey(Account, Key)){
      res.status(403).send("Esiste già un dato con quella chiave");
      return;
    }

    //Gestisci la richiesta POST/data

    try{
      fs.writeFileSync("JSON set/Data/"+Account+"/"+Key+".txt", Data);
      res.status(200).send("Il tuo dato è stato creato con successo");
    }

    catch(err) { res.status(500).send("Problemi interni durante la creazione del tuo nuovo file"); }

  }

});

//Gestione della richiesta *GET/data/:key  -  Ritorna i dati corrispondenti alla chiave       Testato          -    Testato User agent
fastify.route({

  method: "GET",
  path: "/data/:key",
  handler: async(req, res) => {

    console.log("GET/data/:key");

    //console.log(req.params);

    const Key = req.params["key"];

    //Tiro fuori il mio token
    var Token = req.headers.authorization;

    let Account;

    //Richiesta fatta dall' super utente
    if(req.headers["user-agent"] !== "") Account = req.headers["user-agent"];

    else{

      //Ottengo il mio account attraverso l' autenticazione "veloce"
      try{

        await lock.acquire('mutex', async () => {
          await LoginByToken(Token);
          Account = AccountByToken;
        });

      }

      catch(err){
        res.status(403).send("Autenticazione con questo token fallita");
        return; 
      }

    }

    //Gestisci la richiesta GET/data/:key

    //Se non esiste ancora la chiave
    if(!(await ValidKey(Account, Key))){
      res.status(404).send("Non esiste un dato con quella chiave");
      return;
    }

    try{
      const Data =  fs.readFileSync('JSON set/Data/'+Account+"/"+Key+".txt", "UTF-8");
      res.status(200).send(Data.toString());
    }

    catch(err) { res.status(500).send("Errore interno nel prelevare il tuo dato"); }


  }

});

//Gestione della richiesta *PATCH/data/:key  -  Aggiorna i dati corrispondenti alla chiave      Testato        -   Testato User agent
fastify.route({

  method: "PATCH",
  path: "/data/:key",
  handler: async(req, res) => {

    console.log("PATCH/data/:key");

    const Data = req.query["value"];
    const Key = req.params["key"];

    //Tiro fuori il mio token
    var Token = req.headers.authorization;

    let Account;

    //Richiesta fatta dall' super utente
    if(req.headers["user-agent"] !== "") Account = req.headers["user-agent"];

    else{

      //Ottengo il mio account attraverso l' autenticazione "veloce"
      try{

        await lock.acquire('mutex', async () => {
          await LoginByToken(Token);
          Account = AccountByToken;
        });

      }

      catch(err){
        res.status(403).send("Autenticazione fallita con questo token");
        return;
      }

    }

    //Se non esiste ancora la chiave, ridò errore
    if(!(await ValidKey(Account, Key))){
      res.status(404).send("Non esiste ancora un dato con quella chiave");
      return;
    }

    try{

      fs.writeFileSync("JSON set/Data/"+Account+"/"+Key+".txt", Data); 
      res.status(200).send("Il tuo dato è stato aggiornato con successo");

    }

    catch(err){ res.status(500).send("Problemi interni durante l' aggiornamento del tuo dato"); }

  }
  
});

//Gestione della richiesta *DELETE/data/:key  -  Elimina i dati corrispondenti alla chiave      Testato        -    Testato user agent 
fastify.route({

  method: "DELETE",
  path: "/data/:key",
  handler:async(req, res) => {

    console.log("DELETE/data/:key");

    const Key = req.params["key"];

    //Tiro fuori il mio token
    var Token = req.headers.authorization;

    let Account;

    //Richiesta fatta dall' super utente
    if(req.headers["user-agent"] !== "") Account = req.headers["user-agent"];

    else{

      //Ottengo il mio account attraverso l' autenticazione "veloce"
      try{

        await lock.acquire('mutex', async () => {
          await LoginByToken(Token);
          Account = AccountByToken;
        });

      }

      catch(err){
        res.status(403).send("Autenticazione fallita con questo token");
        return;
      }

    }

    //Se non esiste ancora la chiave, ridò errore
    if(!(await ValidKey(Account, Key))){
      res.status(404).send("Non esiste ancora un dato con quella chiave");
      return;
    }

    //Cancello il dato attraverso la chiave
    try{
      fs.unlinkSync("JSON set/Data/"+Account+"/"+Key+".txt");
      res.status(200).send("Eliminazione del tuo dato eseguita correttamente");
    }

    catch(err) { res.status(500).send("Errore durante l' eliminazione del tuo dato"); }

  }

});


//Tutto sequenziale (il server non è ancora partito)

//Creo le cartelle che mi servono per il server
CreateServer();

//Carico i JWT
LoadTokens();

//Cancello i dati rimasti residui
lock.acquire('mutex', async () => { StartClearData(); });

//Tutto asincrono (il server è partito)

//Apro la porta di ascolto
fastify.listen({port: 3000}, (err, addr) => {

  if(err) console.error("Errore, il server non parte: "+err);
  else console.log("Server in ascolto su "+addr);

  //Funzioni che vengono eseguite in modo ciclico dopo tot tempo
  setInterval(TokensBackUp, 2*60*1000);
  setInterval(ClearData, 60*1000);

});