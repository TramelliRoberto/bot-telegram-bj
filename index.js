const TelegramBot = require("node-telegram-bot-api");
const token = "5848803575:AAEh3m4WEXXLV5qWN4vTFHCeYUwyfVqanNs";
const bot = new TelegramBot(token, {
  polling: true,
});
let gameStarted = false; // Flag per indicare se il gioco è in corso
 
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;
  if (messageText === "/start" && !gameStarted) {
    // Se il messaggio è /start e il gioco non è già in corso
    bot.sendMessage(chatId, "Il gioco è iniziato!");
    gameStarted = true;
  } else if (messageText === "/start" && gameStarted) {
    // Se il messaggio è /start e il gioco è già in corso
    bot.sendMessage(chatId, "Il gioco è già in corso!");
  } else if (messageText === "/play" && gameStarted) {
    // Se il messaggio è /play e il gioco è in corso
    bot.sendMessage(chatId, "Il gioco continua!");
  } else if (messageText === "/play" && !gameStarted) {
    // Se il messaggio è /play e il gioco non è ancora iniziato
    bot.sendMessage(
      chatId,
      "Il gioco non è ancora iniziato. Scrivi /start per iniziare!"
    );
  }
});
var user_id = null;
const mysql = require("mysql");
// Configurazione della connessione al database MySQL
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "password.123",
  database: "bot_blackjack",
});
function getPlayerStats(playerId, callback) {
  const query = `SELECT * FROM bot_blackjack.player_stats WHERE player_id = ${playerId}`;
  connection.query(query, (error, results, fields) => {
    if (error) throw error;
    if (results.length > 0) {
      const playerStats = {
        gamesPlayed: results[0].gamesPlayed,
        wins: results[0].win,
        losses: results[0].losses,
        ties: results[0].ties,
      };
      console.log(playerStats);
      callback(playerStats);
    } else {
      const playerStats = {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        ties: 0,
      };
      const insert_query =
        "INSERT INTO bot_blackjack.player_stats (gamesPlayed, win, losses, ties, player_id) VALUES (0,0,0,0,?)";
      connection.query(insert_query, [playerId], (error, results, fields) => {
        if (results.affectedRows == 1)
          console.log("User aggiunto con successo.");
      });
      callback(playerStats);
    }
    // Aggiorna il playerId nel database
    const update_query =
      "UPDATE bot_blackjack.player_stats SET player_id = ? WHERE player_id IS NULL";
    connection.query(update_query, [playerId], (error, results, fields) => {
      if (error) throw error;
      console.log(`player_id ${playerId} aggiunto al database`);
    });
  });
}

const { createDeck, cardValue } = require("./deck");
const deck = createDeck();

// Comando /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Benvenuto nel bot di blackjack! Usa il comando /play per iniziare una partita."
  );
});

// Comando /play
bot.onText(/play/, (msg) => {
  // Distribuzione delle carte
  const playerCards = [deck.pop(), deck.pop()];
  const dealerCards = [deck.pop(), deck.pop()];
  let playerValue = calculateHandValue(playerCards);
  let dealerValue = calculateHandValue([dealerCards[0]]);
  bot.removeTextListener(/statistiche player/);
  bot.removeTextListener(/Hit/);
  bot.removeTextListener(/Stand/);
  // Invia le carte al giocatore
  bot.sendMessage(
    msg.chat.id,
    `Le tue carte sono: ${playerCards.join(", ")}. Il valore delle tue carte è ${playerValue}. Hit o Stand ?`,
    {
      reply_markup: {
        keyboard: [
          ["Hit"],
          ["Stand"],
          ["statistiche player"],
        ],
        one_time_keyboard: true,
      },
    }
  );
  user_id = msg.from.id;
  console.log(user_id);
  // Chiamata a getPlayerStats per recuperare le statistiche del giocatore
  getPlayerStats(user_id, (playerStats) => {
    console.log("Statistiche del giocatore:", playerStats);
  });
  // Invia la carta scoperta del mazziere
  bot.sendMessage(
    msg.chat.id,
    `La carta scoperta del mazziere è: ${dealerCards[0]}`
  );

  let handler = (ms) =>{
    bot.removeAllListeners("message", handler);
  }
  bot.onText(/Hit/, (msg) => {
    // Distribuisci un'altra carta al giocatore
    const newCard = deck.pop();
    playerCards.push(newCard);
    playerValue += cardValue[newCard.slice(0, 1)];

    // Controlla se il giocatore ha sballato
    if (playerValue > 21) {
      bot.sendMessage(
        msg.chat.id,
        `Hai sballato con un valore di ${playerValue}. La mano del mazziere era ${dealerCards.join(
          ", "
        )}.`
      );
    } else {
      // Mostra le nuove carte del giocatore e chiedi di nuovo
      bot.sendMessage(
        msg.chat.id,
        `Le tue carte sono: ${playerCards.join(", ")}. Il valore delle tue carte è ${playerValue}. Hit o Stand ?`,
        {
          reply_markup: {
            keyboard: [["Hit", "Stand"]],
            one_time_keyboard: true,
          },
        }
      );
    }
  });
  bot.onText(/Stand/, (msg) => {
    while (dealerValue < 17) {
      const newCard = deck.pop();
      dealerCards.push(newCard);
      dealerValue = calculateHandValue(dealerCards);
      dealerValue = parseInt(dealerValue, 10);
      console.log(
        `Nuova carta del mazziere: ${newCard}, totale: ${dealerValue}`
      );
    }

    // Controlla se il mazziere ha sballato o se il giocatore ha vinto o perso
    if (dealerValue > 21) {
      // Aggiorna le statistiche del giocatore
      getPlayerStats(user_id, (playerStats) => {
        connection.query(
          "UPDATE bot_blackjack.player_stats SET win = win + 1, gamesplayed = gamesplayed + 1  WHERE player_id = ?",
          [user_id],
          (error, results, fields) => {
            if (error) throw error;
            playerStats.wins; // Aggiorna solo il valore "wins" nella variabile "playerStats"
            playerStats.gamesPlayed; // Aggiorna solo il valore "gamesplayed" nella variabile "playerStats"
            console.log("Statistiche del giocatore aggiornate:", playerStats);
          }
        );
      });

      bot.sendMessage(
        msg.chat.id,
        `Hai vinto con un valore di ${playerValue}. La mano del mazziere era ${dealerCards.join(", ")}.`
      );
    } else if (dealerValue > playerValue) {
      // Aggiorna le statistiche del giocatore
      getPlayerStats(user_id, (playerStats) => {
        connection.query(
          "UPDATE bot_blackjack.player_stats SET losses = losses + 1, gamesplayed = gamesplayed + 1  WHERE player_id = ?",
          [user_id],
          (error, results, fields) => {
            if (error) throw error;
            playerStats.losses; // Aggiorna solo il valore "losses" nella variabile "playerStats"
            playerStats.gamesPlayed; // Aggiorna solo il valore "gamesplayed" nella variabile "playerStats"
            console.log("Statistiche del giocatore aggiornate:", playerStats);
          }
        );
      });

      bot.sendMessage(
        msg.chat.id,
        `Hai perso con un valore di ${playerValue}. La mano del mazziere era ${dealerCards.join(", ")}.`
      );
    } else if (dealerValue < playerValue) {
      // Aggiorna le statistiche del giocatore
      getPlayerStats(user_id, (playerStats) => {
        connection.query(
          "UPDATE bot_blackjack.player_stats SET win = win + 1, gamesplayed = gamesplayed + 1  WHERE player_id = ?",
          [user_id],
          (error, results, fields) => {
            if (error) throw error;
            playerStats.wins = results.win; // Aggiorna solo il valore "wins" nella variabile "playerStats"
            playerStats.gamesPlayed = results.gamesplayed; // Aggiorna solo il valore "gamesplayed" nella variabile "playerStats"
            console.log("Statistiche del giocatore aggiornate:", playerStats);
          }
        );
      });

      bot.sendMessage(
        msg.chat.id,
        `Hai vinto con un valore di ${playerValue}. La mano del mazziere era ${dealerCards.join(", ")}.`
      );
    } else {
      // Aggiorna le statistiche del giocatore
      getPlayerStats(user_id, (playerStats) => {
        connection.query(
          "UPDATE bot_blackjack.player_stats SET ties = ties + 1, gamesplayed = gamesplayed + 1 WHERE player_id = ? ",
          [user_id],
          (error, results, fields) => {
            if (error) throw error;
            playerStats.ties; // Aggiorna solo il valore "ties" nella variabile "playerStats"
            playerStats.gamesPlayed; // Aggiorna solo il valore "gamesplayed" nella variabile "playerStats"
            console.log("Statistiche del giocatore aggiornate:", playerStats);
          }
        );
      });

      bot.sendMessage(
        msg.chat.id,
        `Pareggio! Il tuo punteggio è ${playerValue} e la mano del mazziere è ${dealerCards.join(", ")}.`
      );
    }
    bot.sendMessage(
      msg.chat.id,
      'ne facciamo un altra ?',
      {
        reply_markup: {
          keyboard: [
            ["play"],
          ],
          one_time_keyboard: true,
        },
      }
    );
  });

  function calculateHandValue(cards) {
    console.log(cards);
    let handValue = 0;
    let numAces = 0;

    for (let card of cards) {
      const value = cardValue[card.slice(0, 1)];
      if (value === 11) {
        numAces++;
      }
      handValue += value;
    }

    while (handValue > 21 && numAces > 0) {
      handValue -= 10;
      numAces--;
    }

    return handValue;
  }

  // Esempio di utilizzo della funzione getPlayerStats
  bot.onText(/statistiche player/, (msg) => {
    const playerId = msg.from.id;

    getPlayerStats(playerId, (playerStats) => {
      console.log("CIAO");
      bot.sendMessage(
        msg.chat.id,
        `Ecco le tue statistiche:\nPartite giocate: ${playerStats.gamesPlayed}\nVittorie: ${playerStats.wins}\nSconfitte: ${playerStats.losses}\nPareggi: ${playerStats.ties}`
      );
    });
    bot.sendMessage(
      msg.chat.id,
      'giochiamo?',
      {
        reply_markup: {
          keyboard: [
            ["play"],
          ],
          one_time_keyboard: true,
        },
      }
    );
   
  });
  
});