//Librerie
const cryptoJS = require('crypto-js');
const fastify = require('fastify');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const http = require('http');
const express = require('express');

//Trasformo una stringa nel suo hash attraverso la conversione SHA256
function SHA256Encode(text){
  return cryptoJS.SHA256("This works").toString();
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

  //Server per firmare il token
  const secretKey = 'mySecretKey';

  //Dati che si vogliono mettere dentro il token
  let payload = {
    email: Email,
    password: Password,
  };

  //Opzioni da dettagliare per il token
  const options = {
    expiresIn: '30m',
  };

  return jwt.sign(payload, secretKey, options);
  
}

//Controlla se un token è ancora valido od è scaduto
function ValidToken(token){

  //Decodifico il token e gli prendo la data di scadenza. Essendo che mancano i secondi, paragonandoli al tempo attuale, gli aggiungo 3 zeri
  const ExpToken = parseInt(jwt.decode(token).exp.toString()+"000");

  //Ottengo il timestamp attuale
  const TimeNow = new Date().getTime();

  //Faccio il confronto tra il timestamp attuale ed il timestamp di scadenza del token
  return ExpToken >= TimeNow;

}

//Controlla se esiste un account con questa email
function CheckAccount(email){

  fs.stat('JSON set/Account/'+email, (err, stats) => {
    if(err) return false;
    else return true;
  });

}

/*Funzione che ridà l' email dell' account. Se ridà:
undefined = il token non è valido
"" = se l' account non esiste
else = account che mi serve*/
function LoginByToken(token){

  //Se il token è scaduto ridò una stringa
  if(!ValidToken(token)) return undefined;

  //Trovo l' account che mi serve
  let Account = ActualTokens[token];

  //Se non ho trovato l' account dal dizionario ridò una stringa vuota
  if(Account === undefined) Account = "";

  //Trovato l' account dalla lista token, controllo se l' account esiste veramente
  else if(Account !== undefined && !CheckAccount(Account)) Account = "";

  //Ridò la stringa dell' account
  return Account;

}

const app = express();

//Mi segno i token presenti
var ActualTokens = {};

// Gestione della richiesta POST/register
app.post('/register', (req, res) => {
  const { email, password } = req.body;

  //Ridò un errore di sintassi
  if(email === "" || password === ""){
    res.status(400).send('La tua email e la tua password devono essere entrambe riempite');
    return;
  }

  //Se non è stato trovato il file dell' account
  if(!CheckAccount(email)){
    res.status(403).send('Il tuo account è già presente');
    return;
  }

  //Creo il nuovo account
  const data = {

    email: email,
    password: SHA256Encode(password)

  };
  
  const NewData = JSON.stringify(data);
  
  fs.writeFile("JSON set/Account/"+email+".json", NewData, (error) => {

    if(error) res.status(500).send('Si è verificato un errore durante la registrazione del tuo account');
    else res.status(200).send('Account registrato');

  });

});

// Gestione della richiesta POST/login
app.post('/login', (req, res) => {

  const { email, password } = req.body;

  //Se non è stato trovato il file dell' account
  if(!CheckAccount(email)){
    res.status(404).send('Il tuo account non esiste');
    return;
  }

  //Leggo il file dell' account
  fs.readFile("JSON set/Accounts/"+email+".json", 'utf8', (err, data) => {

    if(err){
      res.status(500).send('Si è verificato un errore durante la verifica di compatibilità delle credenziali');
      return;
    }

    //Estraggo i dati dal file JSON per comparare la password
    const Data = JSON.parse(data);
    if(Data.password !== SHA256Encode(password)){
      res.status(403).send('Credenziali errate');
      return;
    }

    //Ritorna ok ed invia anche il JWT
    else {

      //Creo il token
      const Token = CreateJWT(email, Data.password);

      ActualTokens.Token = email;

      //Setto il token nell' header "Authorization"
      res.setHeader('Authorization', "Bearer "+Token);

      //Invio la risposta
      res.status(200).send("Account riconosciuto");
      return;

    }
  });

});

//Gestione della richiesta *DELETE/delete
app.delete("/delete", (req, res) => {

  //Tiro fuori il mio token
  var Token = req.header('Authorization').replace('Bearer ', '');

  //Ottengo il mio account attraverso l' autenticazione "veloce"
  var Account = LoginByToken(Token);

  if(Account === ""){
    res.status(403).send('Nessun account autenticato con questo token');
    return;
  }

  else if(Account === undefined){
    res.status(403).send('Il token è scaduto');
    return;
  }

  //Elimino l' utente
  fs.unlink("JSON set/Accounts/"+email+".json", (err) => {


    //Se non riesco ad eliminare il file
    if(err) {
      res.status(500).send("Errore durante l' eliminazione del tuo account");
      return;
    }

    //Se riesco ad eliminarlo
    else{
      delete ActualTokens.Token;
      res.status(200).send("Il tuo account è stato eliminato con successo");
      return;
    }

  });

});

//Gestione della richiesta *POST/data
app.post("/data", (req, res) => {

});

//Gestione della richiesta *GET/data/:key
app.get("/data/:key", (req, res) => {

  const key = req.params.key;

});

//Gestione della richiesta *PATCH/data/:key
app.patch("/data/:key", (req, res) => {

  const key = req.params.key;

});

//Gestione della richiesta *DELETE/data/:key
app.delete("/data/:key", (req, res) => {

  const key = req.params.key;

});
  

// Avvio del server
app.listen(3000, () => {

  console.log('Server avviato sulla porta 3000');
});


// User

// POST /register - Registra un nuovo utente
// POST /login - Effettua login e riceve in risposta il JWT
// *DELETE /delete - Elimina l’utente attualmente loggato

// Data

// *POST /data - Carica dei dati nuovi
// *GET /data/:key - Ritorna i dati corrispondenti alla chiave
// *PATCH /data/:key - Aggiorna i dati corrispondenti alla chiave
// *DELETE /data/:key - Elimina i dati corrispondenti alla chiave