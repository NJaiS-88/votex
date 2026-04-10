import { Link } from "react-router-dom";

const AuthCard = ({ title, subtitle, altText, altLink, children }) => {
  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-slate-300">{subtitle}</p>

      <div className="mt-6">{children}</div>

      <p className="mt-6 text-sm text-slate-300">
        {altText}{" "}
        <Link to={altLink} className="font-medium text-indigo-400 hover:underline">
          {altLink === "/signup" ? "Create account" : "Login here"}
        </Link>
      </p>
    </div>
  );
};

export default AuthCard;
