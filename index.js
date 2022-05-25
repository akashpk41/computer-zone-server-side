/*
 * Title : Computer Zone
 * Description : A computer parts manufacturer website, where user can order products, admin can add product  cancel orders and delivery orders
 * Author : Akash PK
 * Date : 25-May-2022
 */

//? dependencies
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

//configuration
const app = express();

const port = process.env.PORT || 5000;

// middleware
app.use(express.json());
app.use(cors());

// ! middleware for verify user access .
function verifyJWT(req, res, next) {
  console.log("from mid");
  next();
}

app.get("/", (req, res) => {
  res.send("Server Is Running");
});
//  ? -------------------- MONGODB ---------------------

const uri = `mongodb+srv://${process.env.DB_ADMIN}:${process.env.DB_PASS}@cluster0.5sgow.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    //! --- collection start --------
    const allPartsCollection = await client
      .db("computer-zone")
      .collection("parts");
    const userCollection = await client.db("computer-zone").collection("user");

    //! --- collection end --------

    //     ? send all parts data to the client
    app.get("/parts", verifyJWT, async (req, res) => {
      const result = await allPartsCollection.find().toArray();
      res.send(result);
    });

    // ? generate a token when user create new account or login .
    app.put("/user/:email", async (req, res) => {
      const { email } = req.params;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const accessToken = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "5h",
      });

      res.send({ result, accessToken });
    });

    
  } catch (err) {
    console.log(err);
  }
}

run();
//  ? -------------------- MONGODB ---------------------

app.listen(port, () => {
  console.log(`Server is Running On Port : ${port}`);
});
