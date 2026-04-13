import { Link } from "react-router-dom";

const AuthCard = ({ title, subtitle, altText, altLink, children }) => {
  return (
    <div className="ui-card w-full max-w-md p-8">
      <h1 className="ui-title">{title}</h1>
      <p className="ui-subtitle mt-2">{subtitle}</p>

      <div className="mt-6">{children}</div>

      <p className="mt-6 text-sm text-slate-500 dark:text-slate-300">
        {altText}{" "}
        <Link to={altLink} className="font-medium text-indigo-400 hover:underline">
          {altLink === "/signup" ? "Create account" : "Login here"}
        </Link>
      </p>
    </div>
  );
};

export default AuthCard;
