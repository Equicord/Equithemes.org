import { ErrorHandler } from "@lib/errorHandler";
import clientPromise from "@utils/db";
import type { NextApiRequest, NextApiResponse } from "next";

async function GET(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
        return res.status(405).json({ message: "Method not allowed", wants: "GET" });
    }

    const client = await clientPromise;
    const db = client.db("themesDatabase");
    const themesCollection = db.collection("themes");

    const themes = await themesCollection.find({}, { projection: { _id: 0, content: 0 } }).toArray();

    
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Content-Type", "application/json");
    res.status(200).json(themes);
}

export default ErrorHandler(GET);