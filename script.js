import MongoStore from "connect-mongo";
import session from "express-session";
import bodyParser from "body-parser";
import fetch from 'node-fetch';
import express from "express";
import crypto from "crypto";
import path from "path";
import ejs from "ejs";
import dotenv from 'dotenv';
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// __dirnameの代替を設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const sc = "season0";
const app = express();
const sf = `./${sc}.json`;
const directoryPath = "./";
let PORT = process.env.PORT || 3000;
const password = process.env.password;
const CLIENT_ID = "1208626448328302612";
const CLIENT_SECRET = "AcNFSXQ8E-4NzC-GYEHCXcTm7bVNWsuP";

// 予約済みユーザー名の定義
const RESERVED_USERNAME = "y_kei1215";
const RESERVED_USERNAME_UID = "1007172890501849119";

// レート計算のロジックを関数として定義
function calculateRateChange(winnerRate, loserRate) {
  const rateDiff = winnerRate - loserRate;
  const baseChange = 10;
  const rateMultiplier = rateDiff / 100 * 15;
  
  let rateChange = baseChange + rateMultiplier;
  
  // レート変動の制限
  if (rateChange < 1) rateChange = 1;
  if (rateChange > 25) rateChange = 25;
  
  return Math.round(rateChange);
}

// リクエストのホストURLを動的に取得するミドルウェアを追加
app.use((req, res, next) => {
  const protocol = req.protocol;
  const host = req.get('host');
  req.REDIRECT_URI = `${protocol}://${host}`;
  req.DISCORD_AUTH_URL = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${req.REDIRECT_URI}&scope=identify`;
  next();
});

app.set("trust proxy", 1); // trust first proxy
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set("views", path.join(__dirname));

app.use(
  session({
    store: MongoStore.create({
      mongoUrl: `mongodb+srv://Kei1215:${password}@cluster0.ls5p2tm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`,
    }),
    secret: "keyboard cat",
    resave: true,
    saveUninitialized: true,
    cookie: {
      maxAge: 365 * 24 * 60 * 60 * 1000,
    },
  })
);

function checkDuplicateUid(seasonData, uid) {
  for (let i = 0; i < seasonData.length; i++) {
    if (seasonData[i].uid === uid) {
      return true; // 同じuidが見つかった
    }
  }
  return false; // 同じuidが見つからなかった
}
const registeredUIDs = [
  "1001067573401616395",
  "836120946531631124",
  "1183359797517615105",
  "606040945451859988",
  "728289161563340881",
  "1120263666978279457",
  "906367031241220146",
  "1090426738804281344",
  "1007172890501849119",
  "969238032043630663",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
];
function isUIDRegistered(uid) {
  return registeredUIDs.includes(uid);
}
app.get("/", async(req, res) => {
  const REDIRECT_URI = req.REDIRECT_URI;
  const DISCORD_AUTH_URL = req.DISCORD_AUTH_URL;
  var data = req.session.data || "";
  var code = req.query.code || "";
  var user = req.session.user || "";

  try {
    if (!user && !code) {
      return res.redirect(`${REDIRECT_URI}/login`);
    }

    if (code) {
      var token = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code: code,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      token = await token.json();
      if (token.error == "invalid_grant") {
        return res.redirect(`${REDIRECT_URI}/login`);
      }

      var user = await fetch(`https://discord.com/api/users/@me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
      });
      
      user = await user.json();

      // 許可されたIDかチェック
      if (!isUIDRegistered(user.id)) {
        return res.send(
          `登録の作成ができません。<body onLoad="setTimeout(function(){ window.location.href = '${req.REDIRECT_URI}'; }, 2000);">`
        );
      }

      try {
        // シーズンデータを読み込む
        let sd = fs.readFileSync("./cd/" + sf, "utf8");
        sd = JSON.parse(sd);

        // 初回ログインの場合は登録画面へリダイレクト
        if (!checkDuplicateUid(sd, user.id)) {
          return res.render("register", {
            discord_id: user.id,
            discord_username: user.username,
            url: req.REDIRECT_URI,
            sf: sc,
            user: null
          });
        }

        req.session.data = token;
        req.session.user = user;
        return res.redirect(`${req.REDIRECT_URI}`);
      } catch (error) {
        console.error("シーズンデータの処理中にエラーが発生しました:", error);
        return res.status(500).send("Error processing season data");
      }
    }

    try {
      // JSONデータをパース
      let sd1 = fs.readFileSync("./" + sf, "utf8");
      let sd2 = fs.readFileSync("./cd/" + sf, "utf8");
      var sd3 = JSON.parse(sd1);
      const sd4 = JSON.parse(sd2);

      // フィルタリング
      const fd = sd3.filter((item) => item.consent != true);
      const fd4 = fd.filter((item) => item.p1 == user.username);
      const fd1 = fd.filter((item) => item.p2 == user.username);
      const fd2 = sd3.filter((item) => item.consent === true);
      const fd3 = fd2.filter(
        (item) => item.p1 == user.username || item.p2 == user.username
      );

      const templateData = {
        user: user,
        sf: `${sc}`,
        link0: fd4.map((item) => ({
          name: `${item.p1} vs ${item.p2}`,
          link: `/vsdata/season0/${item.id}`,
          varsion: `${item.varsion}`,
          wn: `${item.wn}`,
          sf: `${sf}`,
        })),
        link1: fd1.map((item) => ({
          name: `${item.p1} vs ${item.p2}`,
          link: `/vsdata/season0/${item.id}`,
          varsion: `${item.varsion}`,
          wn: `${item.wn}`,
          sf: `${sf}`,
        })),
        link2: fd3.map((item) => ({
          name: `${item.p1} vs ${item.p2}`,
          link: `/vsdata/season0/${item.id}`,
          varsion: `${item.varsion}`,
          wn: `${item.wn}`,
          sf: `${sf}`,
        })),
        url: REDIRECT_URI,
        showUsernameForm: false,
        error: null
      };

      return res.render("home", templateData);

    } catch (parseError) {
      console.error(parseError);
      return res.status(500).json({ error: "Error parsing JSON" });
    }

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).send("Authentication failed.");
  }
});

app.get("/sc/:varsion", async (req, res) => {
  var user = req.session.user || "";
  const varsion = req.params.varsion;
  
  if (!user) {
    return res.redirect(`${req.REDIRECT_URI}/login`);
  }

  if (
    varsion == "normal" ||
    varsion == "hard" ||
    varsion == "extra" ||
    varsion == "stella" ||
    varsion == "olivier" ||
    varsion == "cd"
  ) {
    var name;
    var v;
    if (varsion == "stella" || varsion == "olivier") {
      name = varsion;
      v = false;
    } else {
      name = "cd";
      v = varsion == "cd";
    }

    try {
      // cdディレクトリのデータを読み込む（ユーザー一覧用）
      const cdData = fs.readFileSync(path.join(__dirname, "cd", sf), "utf8");
      const cdUsers = JSON.parse(cdData);

      // 対象のディレクトリのファイルを読み込む
      const filePath = path.join(__dirname, name, sf);
      fs.readFile(filePath, "utf8", (err, data) => {
        if (err) {
          if (err.code === 'ENOENT') {
            try {
              fs.mkdirSync(path.join(__dirname, name), { recursive: true });
              fs.writeFileSync(filePath, '[]', 'utf8');
              data = '[]';
            } catch (mkdirError) {
              console.error(mkdirError);
              return res.status(500).json({ error: "Error creating directory" });
            }
          } else {
            console.error(err);
            return res.status(500).json({ error: "Internal Server Error" });
          }
        }

        try {
          const sd = JSON.parse(data);
          // cdUsersからユーザー一覧を取得（自分以外）
          const fd = cdUsers.filter((item) => item.un !== user.username);
          const templateData = {
            set: `/vsdata/ca/${varsion}`,
            user: req.session.user,
            sf: `${sc}`,
            fd: fd,
            v: v,
            url: req.REDIRECT_URI
          };
          res.render("data", templateData);
        } catch (parseError) {
          console.error(parseError);
          return res.status(500).json({ error: "Error parsing JSON" });
        }
      });
    } catch (error) {
      console.error("Error:", error);
      return res.status(500).send("Authentication failed.");
    }
  } else {
    res.send(
      `難易度定義が違います<body onLoad="setTimeout(function(){history.go(-1);}, 2000);">`
    );
  }
});
app.get("/login", async (req, res) => {
  const REDIRECT_URI = req.REDIRECT_URI;
  const templateData = {
    user: req.session.user,
    sf: `${sc}`,
    url: REDIRECT_URI,
    DISCORD_AUTH_URL: req.DISCORD_AUTH_URL,
    error: null
  };
  // HTMLテンプレートをレンダリングしてクライアントに返す
  res.render("login", templateData);
});
app.get("/logout", async (req, res) => {
  req.session.data = "";
  req.session.user = "";
  res.redirect(`${REDIRECT_URI}/login`);
});
app.get("/rate/:type/:name", (req, res) => {
  const seasonNumber = req.params.name;
  var type = req.params.type;
  if (type == "stella"){
    type = "b";
  } else if (type == "olivier") {
    type = "a";
  } else {
    type = "c";
  }
  const filename = `./cd/${seasonNumber}.json`;
  const filePath = path.join(directoryPath, filename);

  // JSONファイルを読み込み
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error reading JSON file");
      return;
    }

    const seasonData = JSON.parse(data);
    const playerData = seasonData.map((player) => {
      return {
        name: player.un,
        rate: player[`${type}rate`],
        nom: player[`${type}nom`],
        w: player[`${type}w`],
        d: player[`${type}d`],
        l: player[`${type}l`],
        ap: player[`${type}ap`],
        fc: player[`${type}fc`],
        max: player[`${type}max`],
      };
    });
    playerData.sort((a, b) => {
      return b.rate - a.rate;
    });

    const templateData = {
      season: `${seasonNumber}`,
      players: playerData,
      user: req.session.user,
      sf: `${sc}`,
      url: req.REDIRECT_URI
    };

    res.render("rate", templateData);
  });
});
app.post("/vsdata/ca/:varsion", (req, res) => {
  var {
    Player2 = 0,
    Player1 = 0,
    Perfectp1 = 0,
    Perfect1 = 0,
    Great1 = 0,
    Good1 = 0,
    Bad1 = 0,
    Miss1 = 0,
    Perfectp2 = 0,
    Perfect2 = 0,
    Great2 = 0,
    Good2 = 0,
    Bad2 = 0,
    Miss2 = 0,
    musicname = 0,
    matchrecords = 0,
    scoringmethod = 0,
    cd1,
    cd2,
  } = req.body;
  const varsion = req.params.varsion;
  var type = varsion;
  if (type == "stella") {
    type = "a";
  } else if (type == "olivier") {
    type = "b";
  } else {
    type = "c";
  }
  if (
    varsion == "normal" ||
    varsion == "hard" ||
    varsion == "extra" ||
    varsion == "stella" ||
    varsion == "olivier" ||
    varsion == "cd"
  ) {
    if (Player1 != Player2) {
      let sd = fs.readFileSync(`./cd/` + sf, "utf8");
      sd = JSON.parse(sd);

      // ユーザー情報からuid、ユーザー名、レートを取得

      // 同じuidがない場合、新しいプレイヤーを追加
      var user1 = username(sd, Player1);
      var user2 = username(sd, Player2);
      user1 = sd[user1];
      user2 = sd[user2];

      const scores1 = [Perfectp1, Perfect1, Great1, Good1, Bad1, Miss1];
      const scores2 = [Perfectp2, Perfect2, Great2, Good2, Bad2, Miss2];
      const all1 = scores1.reduce((total, score) => total + parseInt(score), 0);
      const all2 = scores2.reduce((total, score) => total + parseInt(score), 0);
      if (
        (all1 == 0 && scoringmethod != 1) ||
        (all1 != all2 && varsion != "cd")
      ) {
        res.send(
          `データが正しくありません<body onLoad="setTimeout(function(){history.go(-1);}, 2000);">`
        );
      } else if (user2) {
        var evaluation1 = evaluation(Perfect1, Great1, Good1, Bad1, Miss1);
        var evaluation2 = evaluation(Perfect2, Great2, Good2, Bad2, Miss2);
        var score1;
        var score2;
        var wdl;

        score1 = cs1(Perfectp1, Perfect1, Great1, Good1);
        score2 = cs1(Perfectp2, Perfect2, Great2, Good2);
        console.log(score1);

        // 配列の各要素を整数に変換して合計する
        const all1 = scores1.reduce(
          (total, score) => total + parseInt(score),
          0
        );
        const all2 = scores2.reduce(
          (total, score) => total + parseInt(score),
          0
        );
        
        // スコア計算正
        score1 = score1 / all1;
        score2 = score2 / all2;
        
        // 勝敗判定を修正
        if (score2 > score1) {
          wdl = `${Player2} win`;
        } else if (score2 < score1) {
          wdl = `${Player1} win`;
        } else {
          wdl = `draw`;  // 引き分けの場合を追加
        }

        // スコア表示形式の設定
        if (scoringmethod == 2) {
          score1 = `${Math.round(score1 * 100) / 100}%`;
          score2 = `${Math.round(score2 * 100) / 100}%`;
        } else if (scoringmethod == 3) {
          score1 = String(Math.round(score1 * 10000)).replace(
            /(\d)(?=(\d{3})+(?!\d))/g,
            "$1,"
          );
          score2 = String(Math.round(score2 * 10000)).replace(
            /(\d)(?=(\d{3})+(?!\d))/g,
            "$1,"
          );
        }

        // 敗フラグの設定
        var w1;
        var w2;
        if (wdl == `${Player1} win`) {
          w1 = "win";
          w2 = "lose";
        } else if (wdl == `${Player2} win`) {
          w1 = "lose";
          w2 = "win";
        } else {
          w1 = "draw";
          w2 = "draw";
        }
        let sd1 = fs.readFileSync("./" + sf, "utf8");
        sd1 = JSON.parse(sd1);
        let lastId;
        let lastId1;
        if (sd1.length > 0) {
          lastId1 = sd1.length + 1;
          lastId = crypto
            .createHash("sha256")
            .update(String(sd1.length + 1))
            .digest("hex");
        } else {
          lastId1 = 1;
          lastId = crypto.createHash("sha256").update(String(1)).digest("hex");
        }

        console.log(Miss1, "a");
        // 同じuidがいい場合、新しいプレイヤーを追加
        let newPlayer = {
          varsion: varsion,
          consent: "none",
          mname: musicname || "-",
          method: scoringmethod,
          record: matchrecords,
          id: lastId,
          id2: lastId1,
          p1: Player1,
          p2: Player2,
          nr1: "-",
          nr2: "-",
          spp1: Perfectp1,
          sp1: Perfect1,
          sgr1: Great1,
          sgo1: Good1,
          sb1: Bad1,
          sm1: Miss1,
          spp2: Perfectp2,
          sp2: Perfect2,
          sgr2: Great2,
          sgo2: Good2,
          sb2: Bad2,
          sm2: Miss2,
          s1: score1,
          s2: score2,
          wn: wdl,
          e1: evaluation1 || " ",
          e2: evaluation2 || " ",
          w1: w1,
          w2: w2,
          r1: "-",
          r2: "-",
          cd1: cd1,
          cd2: cd2,
        };
        let convertedPlayer = {};
        for (let key in newPlayer) {
          if (newPlayer.hasOwnProperty(key)) {
            if (!isNaN(newPlayer[key])) {
              if (newPlayer[key] == "") {
                convertedPlayer[key] = 0; // 空の文字を0に換換
              } else {
                convertedPlayer[key] = parseInt(newPlayer[key], 10); // 数値に変換
              }
            } else {
              convertedPlayer[key] = newPlayer[key]; // 数値でない場合はそのまま代入
            }
          }
        }
        sd1.push(convertedPlayer);

        // 更新されたデータをJSON形式に変換してファイルに書き込む
        fs.writeFileSync(sf, JSON.stringify(sd1, null, 2), "utf8");

        // スコアを返す
        res.send(
          `Player2に申請完了<body onLoad="setTimeout(function(){ window.location.href = '${req.REDIRECT_URI}/vsdata/season0/${lastId}'; }, 1000);">`
        );
      } else {
        res.send(
          `プレイヤー2は存在しません<body onLoad="setTimeout(function(){history.go(-1);}, 2000);">`
        );
      }
    } else {
      res.send(
        `プレイヤーが重複してます<body onLoad="setTimeout(function(){history.go(-1);}, 2000);">`
      );
    }
  } else {
    res.send(
      `難易度定義が違います<body onLoad="setTimeout(function(){history.go(-1);}, 2000);">`
    );
  }
});

// ユーザー検索関数を修正
function username(sd, un) {
  const index = sd.findIndex(player => player.un === un);
  return index !== -1 ? index : false;
}
// スコアを計算する関数
function cs1(perfectp, perfect, great, good) {
  return perfectp * 101 + perfect * 100 + great * 80 + good * 50;
}
function evaluation(perfect, great, good, bad, miss) {
  if (perfect + great + good + bad + miss == 0) {
    return "ALL PERFECT+";
  } else if (great + good + bad + miss == 0) {
    return "ALL PERFECT";
  } else if (great + good + bad + miss == 0) {
    return "FULL COMBO";
  }
}
app.get(`/vsdata/${sc}`, (req, res) => {
  try {
    // JSONデータをパース
    let sd = fs.readFileSync(sf, "utf8");
    sd = JSON.parse(sd);

    // フィルタリング: consent が true のものだけを抽出
    const fd1 = sd.filter((item) => item.consent === true);
    const fd2 = fd1.filter((item) => item.record == "yes");

    // 対戦相手1と対戦相手2のリンクを作成
    const links = fd2.map((item, index) => ({
      name: `${item.p1} vs ${item.p2}`,
      link: `/vsdata/season0/${item.id}`,
      varsion: `${item.varsion}`,
      wn: `${item.wn}`,
      sf: `${sf}`,
      id: index + 1,
    }));
    const sortedLinks = links.sort((a, b) => {
      return b.id - a.id;
    });

    const link = {
      links: links,
      user: req.session.user,
      sf: `${sc}`,
      url: req.REDIRECT_URI
    };
    
    res.render("vs", link);
  } catch (parseError) {
    console.error(parseError);
    res.status(500).json({ error: "Error parsing JSON" });
  }
});
app.get(`/vsdata/:season/:nam`, (req, res) => {
  const nam = req.params.nam;
  const season = req.params.season;

  try {
    let sd = fs.readFileSync(`./${season}.json`, "utf8");
    sd = JSON.parse(sd);
    sd = sd.find((item) => item.id === nam);
    const link = {
      md: sd,
      user: req.session.user,
      sf: `${sc}`,
      url: req.REDIRECT_URI
    };

    if (sd) {
      res.render("vs-short", link);
    } else {
      res.status(404).json({ error: "Data not found" });
    }
  } catch (parseError) {
    console.error(parseError);
    res.status(500).json({ error: "Error parsing JSON" });
  }
});
app.post(`/vsdata/${sc}/:nam`, (req, res) => {
  const nam = req.params.nam;
  var user = req.session.user || "";
  
  try {
    let sd = fs.readFileSync(sf, "utf8");
    sd = JSON.parse(sd);
    var sd2 = sd.find((item) => item.id === nam).varsion;
    var type = sd2;
    if (!(type == "stella" || type == "olivier")) {
      type = "cd";
    }
    sd2 = sd.find((item) => item.id === nam).id2 - 1;

    if (sd[sd2].p2 == user.username || sd[sd2].p1 == "y_kei1215") {
      if (sd[sd2].consent != true) {
        try {
          let sd1 = fs.readFileSync(`./${type}/${sf}`, "utf8");
          sd1 = JSON.parse(sd1);
          let sd3 = fs.readFileSync(`./cd/${sf}`, "utf8");
          sd3 = JSON.parse(sd3);

          // ユーザー検索
          var user1 = username(sd3, sd[sd2].p1);
          var user2 = username(sd3, sd[sd2].p2);

          // デバッグ用ログ
          console.log("Player1:", sd[sd2].p1, "Index:", user1);
          console.log("Player2:", sd[sd2].p2, "Index:", user2);
          console.log("Users in cd:", sd3.map(u => u.un));

          if (user1 === false || user2 === false) {
            return res.send(
              `ユーザーが見つかりません。(${sd[sd2].p1}, ${sd[sd2].p2})<body onLoad="setTimeout(function(){history.go(-1);}, 1000);">`
            );
          }

          // レートタイプの決定を修正
          let rateType;
          if (type === "cd") {
            rateType = "c";  // 通常モード
          } else if (type === "stella") {
            rateType = "a";  // ステラモード -> arate
          } else if (type === "olivier") {
            rateType = "b";  // オリヴィエモード -> brate
          }

          // デバッグ用ログを追加
          console.log("Mode:", type, "RateType:", rateType);
          console.log("Before update - Player1:", sd3[user1], "Player2:", sd3[user2]);

          const rateKey = `${rateType}rate`;
          const nomKey = `${rateType}nom`;
          const wKey = `${rateType}w`;
          const dKey = `${rateType}d`;
          const lKey = `${rateType}l`;

          // 対戦数を更新
          sd3[user1][nomKey] += 1;
          sd3[user2][nomKey] += 1;

          // 勝敗を更新
          if (sd[sd2].w1 === "win") {
            sd3[user1][wKey] += 1;
            sd3[user2][lKey] += 1;
          } else if (sd[sd2].w2 === "win") {
            sd3[user1][lKey] += 1;
            sd3[user2][wKey] += 1;
          } else {
            sd3[user1][dKey] += 1;
            sd3[user2][dKey] += 1;
          }

          // レート変更を計算
          const rate1 = sd3[user1][rateKey];
          const rate2 = sd3[user2][rateKey];
          let r1 = 0, r2 = 0;

          if (sd[sd2].w1 === "win") {
            const rateChange = calculateRateChange(rate1, rate2);
            r1 = rateChange;
            r2 = -rateChange;
          } else if (sd[sd2].w2 === "win") {
            const rateChange = calculateRateChange(rate2, rate1);
            r1 = -rateChange;
            r2 = rateChange;
          }

          // レート変更を記録
          sd[sd2].nr1 = rate1;
          sd[sd2].nr2 = rate2;
          sd[sd2].r1 = r1;
          sd[sd2].r2 = r2;

          // 新しいレートを適用
          sd3[user1][rateKey] += r1;
          sd3[user2][rateKey] += r2;

          // デバッグ用ログを追加
          console.log("After update - Player1:", sd3[user1], "Player2:", sd3[user2]);

          // 承認フラグを設定
          sd[sd2].consent = true;

          // ファイルに保存
          fs.writeFileSync(`./cd/${sf}`, JSON.stringify(sd3, null, 2), "utf8");
          fs.writeFileSync(sf, JSON.stringify(sd, null, 2), "utf8");

          return res.send(
            `承認が完了しました。<body onLoad="setTimeout(function(){ window.location.href = '${req.REDIRECT_URI}'; }, 1000);">`
          );
        } catch (error) {
          console.error("Error processing approval:", error);
          return res.status(500).send("Error processing approval");
        }
      }
    }
    return res.send(
      `承認できません。<body onLoad="setTimeout(function(){history.go(-1);}, 1000);">`
    );
  } catch (error) {
    console.error("Error reading files:", error);
    return res.status(500).send("Error reading files");
  }
});



const MAX_PORT_ATTEMPTS = 10;  // 最大試行回数

// ポートが使用中の場合に次のポートを試すための関数
function startServer(port) {
  app.listen(port)
    .on('listening', () => {
      console.log(`Server is running on port ${port}`);
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE' && port < PORT + MAX_PORT_ATTEMPTS) {
        console.log(`Port ${port} is in use, trying ${port + 1}...`);
        startServer(port + 1);
      } else {
        console.error('Failed to start server:', err);
      }
    });
}

// サーバーを起動
startServer(PORT);

// 名前変更画面の表示
app.get("/change-username", async (req, res) => {
  if (!req.session.user) {
    return res.redirect(`${req.REDIRECT_URI}/login`);
  }

  try {
    // JSONデータをパース
    let sd1 = fs.readFileSync("./" + sf, "utf8");
    let sd2 = fs.readFileSync("./cd/" + sf, "utf8");
    var sd3 = JSON.parse(sd1);
    const sd4 = JSON.parse(sd2);

    // フィルタリング
    const fd = sd3.filter((item) => item.consent != true);
    const fd4 = fd.filter((item) => item.p1 == req.session.user.username);
    const fd1 = fd.filter((item) => item.p2 == req.session.user.username);
    const fd2 = sd3.filter((item) => item.consent === true);
    const fd3 = fd2.filter(
      (item) => item.p1 == req.session.user.username || item.p2 == req.session.user.username
    );

    const templateData = {
      user: req.session.user,
      sf: `${sc}`,
      url: req.REDIRECT_URI,
      link0: fd4.map((item) => ({
        name: `${item.p1} vs ${item.p2}`,
        link: `/vsdata/season0/${item.id}`,
        varsion: `${item.varsion}`,
        wn: `${item.wn}`,
        sf: `${sf}`,
      })),
      link1: fd1.map((item) => ({
        name: `${item.p1} vs ${item.p2}`,
        link: `/vsdata/season0/${item.id}`,
        varsion: `${item.varsion}`,
        wn: `${item.wn}`,
        sf: `${sf}`,
      })),
      link2: fd3.map((item) => ({
        name: `${item.p1} vs ${item.p2}`,
        link: `/vsdata/season0/${item.id}`,
        varsion: `${item.varsion}`,
        wn: `${item.wn}`,
        sf: `${sf}`,
      })),
      showUsernameForm: true,
      error: null
    };

    res.render("home", templateData);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).send("Error loading data");
  }
});

// ユーザー名の更新処理
app.post("/update-username", async (req, res) => {
  if (!req.session.user) {
    return res.redirect(`${req.REDIRECT_URI}/login`);
  }

  // 許可されたIDかチェック
  if (!isUIDRegistered(req.session.user.id)) {
    return renderHomeWithError(req, res, "このアカウントは許可されていません。");
  }

  const { username } = req.body;
  const oldUsername = req.session.user.username;

  // y_kei1215の名前変更制限
  if (username === RESERVED_USERNAME && req.session.user.id !== RESERVED_USERNAME_UID) {
    return renderHomeWithError(req, res, "このユーザー名は使用できません。");
  }

  try {
    // cdディレクトリのユーザーデータを更新
    let sd = fs.readFileSync("./cd/" + sf, "utf8");
    sd = JSON.parse(sd);

    // ユーザーの重複チェック
    if (sd.some(user => user.un === username)) {
      return renderHomeWithError(req, res, "このユーザー名は既に使用されています。");
    }

    // ユーザーデータの更新
    const userIndex = sd.findIndex(user => user.uid === req.session.user.id);
    if (userIndex !== -1) {
      sd[userIndex].un = username;
      fs.writeFileSync("./cd/" + sf, JSON.stringify(sd, null, 2), "utf8");

      // メインの対戦記録を更新
      let matchData = fs.readFileSync(sf, "utf8");
      matchData = JSON.parse(matchData);
      matchData.forEach(match => {
        if (match.p1 === oldUsername) {
          match.p1 = username;
          if (match.wn === `${oldUsername} win`) match.wn = `${username} win`;
          if (match.wn === `${oldUsername} draw`) match.wn = `${username} draw`;
        }
        if (match.p2 === oldUsername) {
          match.p2 = username;
          if (match.wn === `${oldUsername} win`) match.wn = `${username} win`;
          if (match.wn === `${oldUsername} draw`) match.wn = `${username} draw`;
        }
      });
      fs.writeFileSync(sf, JSON.stringify(matchData, null, 2), "utf8");

      // stella/olivierの対戦記録も更新
      const modes = ['stella', 'olivier'];
      for (const mode of modes) {
        try {
          const modePath = path.join(__dirname, mode, sf);
          if (fs.existsSync(modePath)) {
            let modeData = fs.readFileSync(modePath, "utf8");
            modeData = JSON.parse(modeData);
            let updated = false;

            modeData.forEach(match => {
              if (match.p1 === oldUsername) {
                match.p1 = username;
                if (match.wn === `${oldUsername} win`) match.wn = `${username} win`;
                if (match.wn === `${oldUsername} draw`) match.wn = `${username} draw`;
                updated = true;
              }
              if (match.p2 === oldUsername) {
                match.p2 = username;
                if (match.wn === `${oldUsername} win`) match.wn = `${username} win`;
                if (match.wn === `${oldUsername} draw`) match.wn = `${username} draw`;
                updated = true;
              }
            });

            if (updated) {
              fs.writeFileSync(modePath, JSON.stringify(modeData, null, 2), "utf8");
            }
          }
        } catch (error) {
          console.error(`Error updating ${mode} data:`, error);
        }
      }

      // セッションのユーザー名を更新
      req.session.user.username = username;

      return res.redirect(`${req.REDIRECT_URI}`);
    }

    return res.status(404).send("User not found");
  } catch (error) {
    console.error("ユーザー名の更新中にエラーが発生しました:", error);
    return renderHomeWithError(req, res, "エラーが発生しました。");
  }
});

// エラーメッセージ付きでホーム画面を表示する関数
async function renderHomeWithError(req, res, errorMessage) {
  try {
    let sd1 = fs.readFileSync("./" + sf, "utf8");
    let sd2 = fs.readFileSync("./cd/" + sf, "utf8");
    var sd3 = JSON.parse(sd1);
    const sd4 = JSON.parse(sd2);

    const fd = sd3.filter((item) => item.consent != true);
    const fd4 = fd.filter((item) => item.p1 == req.session.user.username);
    const fd1 = fd.filter((item) => item.p2 == req.session.user.username);
    const fd2 = sd3.filter((item) => item.consent === true);
    const fd3 = fd2.filter(
      (item) => item.p1 == req.session.user.username || item.p2 == req.session.user.username
    );

    const templateData = {
      user: req.session.user,
      sf: `${sc}`,
      url: req.REDIRECT_URI,
      link0: fd4.map((item) => ({
        name: `${item.p1} vs ${item.p2}`,
        link: `/vsdata/season0/${item.id}`,
        varsion: `${item.varsion}`,
        wn: `${item.wn}`,
        sf: `${sf}`,
      })),
      link1: fd1.map((item) => ({
        name: `${item.p1} vs ${item.p2}`,
        link: `/vsdata/season0/${item.id}`,
        varsion: `${item.varsion}`,
        wn: `${item.wn}`,
        sf: `${sf}`,
      })),
      link2: fd3.map((item) => ({
        name: `${item.p1} vs ${item.p2}`,
        link: `/vsdata/season0/${item.id}`,
        varsion: `${item.varsion}`,
        wn: `${item.wn}`,
        sf: `${sf}`,
      })),
      error: errorMessage,
      showUsernameForm: true
    };

    return res.render("home", templateData);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).send("Error loading data");
  }
}

app.get("/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(directoryPath, filename);

  // 指定されたファイルを読み込み、内容をスポンスとして送信
  fs.readFile(filePath, "utf-8", (err, content) => {
    if (err) {
      return res.send("ファイルの読込み中にエラーが発生しました。");
    }
    res.json(JSON.parse(content));
  });
});

// 次シーズン作成用のルート
app.get("/create-next-season", async (req, res) => {
  if (!req.session.user || req.session.user.username !== "y_kei1215") {
    return res.redirect(`${req.REDIRECT_URI}`);
  }

  try {
    // 現在のシーズン番��を取得
    const currentSeason = parseInt(sc.replace("season", ""));
    const nextSeason = currentSeason + 1;
    const nextSeasonFile = `season${nextSeason}.json`;

    // 各ディレクトリのファイルをコピー
    const directories = ["", "cd", "stella", "olivier"];
    
    for (const dir of directories) {
      const sourcePath = path.join(__dirname, dir, `season${currentSeason}.json`);
      const targetPath = path.join(__dirname, dir, nextSeasonFile);

      if (fs.existsSync(sourcePath)) {
        // ファイルを読み込んで初期化
        let data = fs.readFileSync(sourcePath, "utf8");
        let jsonData = JSON.parse(data);

        if (dir === "cd") {
          // cdディレクトリの場合、レート関連のデータのみリセット
          jsonData = jsonData.map(player => ({
            ...player,
            arate: 1500,
            anom: 0,
            aw: 0,
            ad: 0,
            al: 0,
            aap: 0,
            afc: 0,
            amax: 0,
            brate: 1500,
            bnom: 0,
            bw: 0,
            bd: 0,
            bl: 0,
            bap: 0,
            bfc: 0,
            bmax: 0,
            crate: 1500,
            cnom: 0,
            cw: 0,
            cd: 0,
            cl: 0,
            cap: 0,
            cfc: 0,
            cmax: 0
          }));
        } else {
          // 対戦記録ファイルの場合は空の配列で初期化
          jsonData = [];
        }

        // 新しいファイルに書き込み
        fs.writeFileSync(targetPath, JSON.stringify(jsonData, null, 2), "utf8");
      }
    }

    return res.send(
      `次シーズンのファイルを作成しました。<body onLoad="setTimeout(function(){ window.location.href = '${req.REDIRECT_URI}'; }, 1000);">`
    );
  } catch (error) {
    console.error("Error creating next season:", error);
    return res.status(500).send("Error creating next season files");
  }
});
