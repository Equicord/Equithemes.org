import App from "@components/page/theme-list";
import { useWebContext } from "@context/auth";
import clientPromise from "@utils/db";
import { getUser } from "@utils/auth";

export async function getServerSideProps({ req }) {
    const client = await clientPromise;
    const db = client.db("submittedThemesDatabase");
    const themesCollection = db.collection("pending");

    const cookieHeader = req.headers.cookie || "";
    const getCookieServer = (name: string) => {
        const value = "; " + cookieHeader;
        const parts = value.split("; " + name + "=");
        if (parts.length === 2) return parts.pop()?.split(";").shift();
        return undefined;
    };

    const token = getCookieServer("_dtoken");
    const user = await getUser(token || "");

    if (!user || !user.admin) {
        return {
            props: {
                initialThemes: [],
                isAdmin: false
            }
        };
    }

    const themes = await themesCollection.find({}, {
        projection: { themeContent: 0, file: 0, fileUrl: 0 }
    }).toArray();

    return {
        props: {
            initialThemes: JSON.parse(JSON.stringify(themes)),
            isAdmin: true
        }
    };
}

export default function ThemeSubmittedList({ initialThemes, isAdmin: initialIsAdmin }) {
    const { authorizedUser, isLoading } = useWebContext();

    const isAdmin = initialIsAdmin || authorizedUser?.admin;

    return (
        <div className="min-h-screen flex flex-col">
            <main className="flex-grow container mx-auto flex flex-col mt-6">
                {isLoading && !initialThemes ? (
                    <div className="text-center text-lg text-foreground">Loading...</div>
                ) : !isAdmin ? (
                    <div className="text-center text-lg text-foreground">
                        You need to be an admin to view this page.
                        <div className="mt-2">
                            <a href="/" className="text-primary hover:underline">
                                Return to home
                            </a>
                        </div>
                    </div>
                ) : (
                    <App initialThemes={initialThemes} />
                )}
            </main>
        </div>
    );
}
