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
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { verify } = require("jsonwebtoken");
const stripe = require("stripe")(
  "sk_test_51L3Z2yKqOwHYefqRxypeZ6pKyRUT9EmuuY1xjM1MCk2Tj7LaGfMs3MvGEe4HwKhr0F1AE1YZpv3MBEqoMuYXYwlu00tmPS2Iox"
);
require("dotenv").config({ path: "./vars/.env" });
//configuration
const app = express();

const port = process.env.PORT || 5000;

// middleware
app.use(express.json());
app.use(cors());

// ! middleware for verify user access .
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized Access" });
  } else {
    const accessToken = authHeader.split(" ")[1];

    jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).send({ message: "Forbidden Access" });
      } else {
        req.decoded = decoded;
        next();
      }
    });
  }
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
    const partsCollection = await client
      .db("computer-zone")
      .collection("parts");
    const userCollection = await client.db("computer-zone").collection("user");
    const bookingCollection = await client
      .db("computer-zone")
      .collection("booking");
    const reviewCollection = await client
      .db("computer-zone")
      .collection("reviews");
    const paymentCollection = await client
      .db("computer-zone")
      .collection("payment");
    //! --- collection end --------

    // ! verify admin
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      // console.log(requesterAccount);
      // ! check  the user admin or not.
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "Forbidden Access" });
      }
    };

    //     ? send all parts data to the client
    app.get("/parts", async (req, res) => {
      const result = await partsCollection.find().toArray();
      res.send(result);
    });

    // ? get single parts data
    app.get("/parts/:id", verifyJWT, async (req, res) => {
      const { id } = req.params;

      const result = await partsCollection.findOne({ _id: ObjectId(id) });
      res.send(result);
    });

    // ? send all user reviews data
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // ? save users review data to the server
    app.post("/reviews", verifyJWT, async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
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

    // ? save booking information
    app.post("/booking", verifyJWT, async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    // ? send booking data to the client
    app.get("/booking", verifyJWT, async (req, res) => {
      const { email } = req.query;
      // ! check valid user then send data .
      const decodedEmail = req.decoded.email;
      if (email === decodedEmail) {
        const result = await bookingCollection.find({ email: email }).toArray();
        res.send(result);
      } else {
        res.status(403).send({ message: "Forbidden Access" });
      }
    });

    // ! save payment data in the server

    app.patch("/booking/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          status: "pending",
          transactionId: payment.transactionId,
        },
      };

      const result = await paymentCollection.insertOne(payment);
      const updatedBooking = await bookingCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(updatedBooking);
    });

    // ? send a single booking data to the client
    app.get("/booking/:id", verifyJWT, async (req, res) => {
      const { id } = req.params;
      const result = await bookingCollection.findOne({ _id: ObjectId(id) });
      res.send(result);
    });

    //? save payment information in the server
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;

      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "bdt",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // ! --------- For Admin Dashboard ----------
    app.get("/user", verifyJWT, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // ? make an user to an admin
    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const { email } = req.params;

      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);

      res.send(result);
    });

    //  ? get admin status
    app.get("/admin/:email", async (req, res) => {
      const { email } = req.params;
      const user = await userCollection.findOne({
        email: email,
      });
      // console.log(user.role);

      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    // ? add computer parts information in the database .
    app.post("/parts", verifyJWT, verifyAdmin, async (req, res) => {
      const parts = req.body;
      const result = await partsCollection.insertOne(parts);
      res.send(result);
    });

    // ! --------- For Admin Dashboard ----------
  } catch (err) {
    console.log(err.message);
  }
}

run();
//  ? -------------------- MONGODB ---------------------

app.listen(port, () => {
  console.log(`Server is Running On Port : ${port}`);
});
