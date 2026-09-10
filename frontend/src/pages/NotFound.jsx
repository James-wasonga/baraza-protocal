import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <p className="font-display text-4xl text-bone-100 mb-3">Not found</p>
      <p className="text-bone-500 mb-6">There's no page or dispute at this address.</p>
      <Link to="/" className="btn-primary inline-flex">
        Back to home
      </Link>
    </div>
  );
}
