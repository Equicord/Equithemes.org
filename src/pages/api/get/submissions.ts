import clientPromise from "@utils/db";
import { ObjectId } from "mongodb";
import type { NextApiRequest, NextApiResponse } from "next";
import { isAuthed } from "@utils/auth";
import { ErrorHandler } from "@lib/errorHandler";
export interface ValidatedUser {
    id: string;
    username: string;
    avatar: string;
}

export interface SubmittedAt {
    $date: string;
}

export interface Moderator {
    discord_snowflake: string;
    discord_name: string;
    avatar_url: string;
}

export interface RootObject {
    title: string;
    description: string;
    sourceLink: string;
    validatedUsers: { [key: string]: ValidatedUser };
    themeContent: string;
    submittedAt: SubmittedAt;
    reason: string;
    state: string;
    moderator: Moderator;
}

async function GET(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
        return res.status(405).json({ message: "Method not allowed", wants: "GET" });
    }

    const client = await clientPromise;
    const db = client.db("submittedThemesDatabase");
    const themesCollection = db.collection("pending");

    const { authorization } = req.headers;

    if (!authorization) {
        return res.status(400).json({ message: "Cannot check authorization without unique token" });
    }

    const token = authorization?.replace("Bearer ", "")?.trim() ?? null;

    if (!token) {
        return res.status(400).json({ message: "Invalid Request, unique user token is missing" });
    }

    const user = await isAuthed(token as string);

    if (!user) {
        return res.status(401).json({ status: 401, message: "Given token is not authorized" });
    }

    const { id } = req.query;

    if (id) {
        try {
            const theme = await themesCollection.findOne({ _id: new ObjectId(id as string) });
            if (!theme) {
                return res.status(404).json({ message: "Submission not found" });
            }
            if (!user.admin && theme.user !== user.username) {
                return res.status(403).json({ message: "Forbidden" });
            }
            return res.status(200).json(theme);
        } catch (err) {
            return res.status(400).json({ message: "Invalid ID format" });
        }
    }

    const query = user.admin ? {} : { user: user.username };
    const themes = await themesCollection.find(query, { projection: { themeContent: 0, file: 0, fileUrl: 0 } }).toArray();

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(themes);
}

export default ErrorHandler(GET);