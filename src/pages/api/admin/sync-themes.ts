import clientPromise from "@utils/db";
import type { NextApiRequest, NextApiResponse } from "next";
import { isAuthed } from "@utils/auth";
import { ErrorHandler } from "@lib/errorHandler";
import fs from "fs";
import path from "path";

async function POST(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed", wants: "POST" });
    }

    const { authorization } = req.headers;

    if (!authorization) {
        return res.status(400).json({ message: "Cannot check authorization without unique token" });
    }

    const token = authorization.replace("Bearer ", "").trim();

    if (!token) {
        return res.status(400).json({ status: 400, message: "Invalid Request, unique user token is missing" });
    }

    const user = await isAuthed(token as string);

    if (!user || !user.admin) {
        return res.status(403).json({ status: 403, message: "Unauthorized. Admin access required." });
    }

    try {
        const themesJsonPath = path.join(process.cwd(), "themes.json");
        const themesData = JSON.parse(fs.readFileSync(themesJsonPath, "utf8"));

        const client = await clientPromise;
        const themesDb = client.db("themesDatabase");
        const themesCollection = themesDb.collection("themesDatabase");

        let approvedUpdated = 0;
        let approvedInserted = 0;
        const approvedUpdates = [];

        for (const theme of themesData) {
            if (!theme.id) {
                console.warn(`Skipping theme without id: ${theme.name}`);
                continue;
            }

            approvedUpdates.push({
                updateOne: {
                    filter: { id: theme.id },
                    update: { $set: { name: theme.name } },
                    upsert: true
                }
            });
        }

        if (approvedUpdates.length > 0) {
            const result = await themesCollection.bulkWrite(approvedUpdates);
            approvedUpdated = result.modifiedCount || 0;
            approvedInserted = result.upsertedCount || 0;
        }

        const submittedDb = client.db("submittedThemesDatabase");
        const pendingCollection = submittedDb.collection("pending");
        const submissions = await pendingCollection.find({}).toArray();
        const submissionUpdates = [];

        for (const submission of submissions) {
            const truncatedTitle = submission.title.slice(0, 40);
            if (submission.title !== truncatedTitle) {
                submissionUpdates.push({
                    updateOne: {
                        filter: { _id: submission._id },
                        update: { $set: { title: truncatedTitle } }
                    }
                });
            }
        }

        let submissionsUpdated = 0;
        if (submissionUpdates.length > 0) {
            const result = await pendingCollection.bulkWrite(submissionUpdates);
            submissionsUpdated = result.modifiedCount || 0;
        }

        return res.status(200).json({
            status: 200,
            message: "Database sync completed successfully",
            approved: {
                updated: approvedUpdated,
                inserted: approvedInserted,
                total: themesData.length
            },
            submissions: {
                updated: submissionsUpdated,
                total: submissions.length,
                description: "Pending/rejected themes - titles truncated to 40 characters max"
            }
        });
    } catch (error) {
        console.error("Database sync error:", error);
        return res.status(500).json({
            status: 500,
            message: "Failed to sync database",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
}

export default ErrorHandler(POST);
