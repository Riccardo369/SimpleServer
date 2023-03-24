//Librerie
const cryptoJS = require('crypto-js');
const fastify = require('fastify');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const http = require('http');
const express = require('express');

function SHA256(text){
  return cryptoJS.SHA256("This works").toString();
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

  let token = jwt.sign(payload, secretKey, options);

  return token;
}


const express = require('express');
const app = express();

// Middleware per il parsing del body della richiesta
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Gestione della richiesta POST
app.post('/register', (req, res) => {
  const { email, password } = req.body;

  fs.stat('JSON set/Account/'+email, (err, stats) => {
    if (!err) res.status(200).send('Si è verificato un errore durante la registrazione del tuo account'); //Modificare numero di risposta
  });

  const data = {

    email: email,
    password: password,

  };
  
  var JSONdata = JSON.stringify(data);
  
  fs.writeFile('JSON set/Account/file.json', JSONdata, (error) => {

    if(error) res.status(200).send('Si è verificato un errore durante la registrazione del tuo account'); //Modificare numero di risposta
    else res.status(200).send('Account registrato');

  });
});

// Avvio del server
app.listen(3000, () => {
  console.log('Server avviato sulla porta 3000');
});

/* const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World\n');
});

server.listen(port, hostname, () => {console.log(`Server running at http://${hostname}:${port}/`);}); */


//User

//POST /register - Registra un nuovo utente
//POST /login - Effettua login e riceve in risposta il JWT
//*DELETE /delete - Elimina l’utente attualmente loggato

//Data

//*POST /data - Carica dei dati nuovi
//*GET /data/:key - Ritorna i dati corrispondenti alla chiave
//*PATCH /data/:key - Aggiorna i dati corrispondenti alla chiave
//*DELETE /data/:key - Elimina i dati corrispondenti alla chiave	


function RegisterAccount(Email, Password){

  const data = {

    email: Email,
    password: Password,

  };
  
  var JSONdata = JSON.stringify(data);
  
  fs.writeFile('JSON set/Account/file.json', JSONdata, (error) => {

    if(error) return false;
    else return true;

  });

}

function LoginAccount(email, password){

}

function CheckAccount(email, password){

}

function DeleteAccount(email, password){

}