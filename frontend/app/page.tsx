import { redirect } from "next/navigation";

export default function Home() {
    // Redirect to signup page as the default landing page
    redirect("/login");
}
