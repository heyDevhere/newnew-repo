import express from "express";
import dbConnect from "../lib/dbConnect.js";
import AgoraAccessToken from "agora-access-token";
const { RtcTokenBuilder, RtcRole } = AgoraAccessToken;
const { RtmTokenBuilder, RtmRole } = AgoraAccessToken;

import Room from "../models/Room.js";

const router = express.Router();

// Helper function to generate RTM token
function getRtmToken(userId) {
  const appID = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERT;
  const account = userId;
  const expirationTimeInSeconds = 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  const token = RtmTokenBuilder.buildToken(
    appID,
    appCertificate,
    account,
    RtmRole.Rtm_User,
    privilegeExpiredTs
  );
  return token;
}

// Helper function to generate RTC token
function getRtcToken(roomId, userId) {
  const appID = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERT;
  const channelName = roomId;
  const account = userId;
  const role = RtcRole.PUBLISHER;
  const expirationTimeInSeconds = 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  const token = RtcTokenBuilder.buildTokenWithAccount(
    appID,
    appCertificate,
    channelName,
    account,
    role,
    privilegeExpiredTs
  );

  return token;
}

// GET: Fetch an available room and generate tokens
router.get("/", async (req, res) => {
  const { userId } = req.query;

  try {
    await dbConnect();
    const rooms = await Room.aggregate([
      { $match: { status: "waiting" } },
      { $sample: { size: 1 } },
    ]);

    if (rooms.length > 0) {
      const roomId = rooms[0]._id.toString();
      await Room.findByIdAndUpdate(roomId, { status: "chatting" });
      res.status(200).json({
        rooms,
        rtcToken: getRtcToken(roomId, userId),
        rtmToken: getRtmToken(userId),
      });
    } else {
      res.status(200).json({ rooms: [], token: null });
    }
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(400).json({ message: error.message });
  }
});

// POST: Create a new room and generate tokens
router.post("/", async (req, res) => {
  const { userId } = req.query;

  try {
    await dbConnect();
    const room = await Room.create({ status: "waiting" });
    res.status(200).json({
      room,
      rtcToken: getRtcToken(room._id.toString(), userId),
      rtmToken: getRtmToken(userId),
    });
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ message: "Failed to create room" });
  }
});

// GET: Fetch a specific room and generate tokens (based on roomId)
router.put("/:roomId", async (req, res) => {
  const { roomId } = req.params;

  // Connect to the database
  await dbConnect();

  try {
    // Update the room status to "waiting"
    await Room.findByIdAndUpdate(roomId, { status: 'waiting' });

    // Send a success response
    res.status(200).json({ message: 'success' });
  } catch (error) {
    // Handle any errors
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
