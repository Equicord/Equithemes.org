import clientPromise from "@utils/db";
import type { NextApiRequest, NextApiResponse } from "next";
import { isAuthed } from "@utils/auth";
import { ObjectId } from "mongodb";
import { ErrorHandler } from "@lib/errorHandler";

async function POST(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed", wants: "POST" });
    }

    const { authorization } = req.headers;
    const { id } = req.query;
    const { reason = "", banUser = false, banReason = "" } = req.body;

    if (!authorization) {
        return res.status(400).json({ message: "Cannot check authorization without unique token" });
    }

    const token = authorization.replace("Bearer ", "").trim();

    if (!token) {
        return res.status(400).json({ status: 400, message: "Invalid Request, unique user token is missing" });
    }

    const user = await isAuthed(token as string);

    if (!user) {
        return res.status(401).json({ status: 401, message: "Given token is not authorized" });
    }

    if (!user.admin) {
        return res.status(403).json({ status: 403, message: "Unauthorized" });
    }

    if (!id) {
        return res.status(400).json({
            status: 400,
            message: "Invalid Request - Missing required fields",
            fields: ["id"]
        });
    }

    try {
        const client = await clientPromise;
        const submittedDb = client.db("submittedThemesDatabase");
        const usersDb = client.db("discordUsers");
        const pendingCollection = submittedDb.collection("pending");
        const usersCollection = usersDb.collection("users");
        const themesCollection = client.db("themesDatabase");
        const notificationsCollection = themesCollection.collection("notifications");

        const theme = await pendingCollection.findOne({ _id: new ObjectId(id as string) });

        if (!theme) {
            return res.status(404).json({
                status: 404,
                message: "Theme not found"
            });
        }

        if (theme.state !== "pending") {
            return res.status(400).json({
                status: 400,
                message: "Theme is not pending"
            });
        }


        await pendingCollection.updateOne(
            { _id: new ObjectId(id as string) },
            {
                $set: {
                    state: "rejected",
                    reason: reason || "No reason provided",
                    rejectedAt: new Date(),
                    moderator: {
                        discord_snowflake: user.id,
                        discord_name: user.global_name || "",
                        avatar_url: user.avatar || ""
                    }
                },
                $unset: {
                    contributors: "",
                    submittedBy: ""
                }
            }
        );


        await notificationsCollection.insertOne({
            userId: theme.submittedBy,
            type: "theme_rejected",
            themeId: id,
            themeName: theme.title,
            message: `Your theme "${theme.title}" has been rejected.`,
            reason: reason || "No reason provided",
            createdAt: new Date(),
            read: false
        });


        if (banUser) {
            await usersCollection.updateOne(
                { "user.id": theme.submittedBy },
                {
                    $set: {
                        "user.bannedFromSubmissions": true,
                        "user.banReason": banReason || "Rejected multiple times",
                        "user.bannedAt": new Date(),
                        "user.bannedBy": {
                            discord_snowflake: user.id,
                            discord_name: user.global_name || "",
                            avatar_url: user.avatar || ""
                        }
                    }
                }
            );
        }

        return res.status(200).json({ status: 200, title: theme.title, message: "Theme rejected", banned: banUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 500,
            message: "Internal Server Error"
        });
    }
}

export default ErrorHandler(POST);