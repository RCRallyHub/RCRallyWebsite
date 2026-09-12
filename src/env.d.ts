/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    /** Set by src/middleware.ts once a request's session cookie has been validated. */
    adminUser?: {
      id: number;
      username: string;
    };
  }
}
