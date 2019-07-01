"use strict";

const _ = require("lodash");
const ApiGateway = require("moleculer-web");
const { UnAuthorizedError } = ApiGateway.Errors;

module.exports = {
	name: "api",
	mixins: [ApiGateway],

	settings: {
		port: process.env.PORT || 3000,

		routes: [{
			path: "/api",

			authorization: true,

			aliases: {
				// Login
				"POST /users/login": "users.login",

				// Users
				"REST /users": "users",

				// Current user
				"GET /user": "users.me",
				"PUT /user": "users.updateMyself",

				// Articles
				"GET /articles/feed": "articles.feed",
				"REST /articles": "articles",
				"GET /tags": "articles.tags",

				// Comments
				"GET /articles/:slug/comments": "articles.comments",
				"POST /articles/:slug/comments": "articles.addComment",
				"PUT /articles/:slug/comments/:commentID": "articles.updateComment",
				"DELETE /articles/:slug/comments/:commentID": "articles.removeComment",

				// Favorites
				"POST /articles/:slug/favorite": "articles.favorite",
				"DELETE /articles/:slug/favorite": "articles.unfavorite",

				// Profile
				"GET /profiles/:username": "users.profile",
				"POST /profiles/:username/follow": "users.follow",
				"DELETE /profiles/:username/follow": "users.unfollow",
			},

			// Disable to call not-mapped actions
			mappingPolicy: "restrict",

			// Set CORS headers
			//cors: true,

			// Parse body content
			bodyParsers: {
				json: {
					strict: false
				},
				urlencoded: {
					extended: false
				}
			}
		}],

		assets: {
			folder: "./public"
		},

		// logRequestParams: "info",
		// logResponseData: "info",

		onError(req, res, err) {
			// Return with the error as JSON object
			res.setHeader("Content-type", "application/json; charset=utf-8");
			res.writeHead(err.code || 500);

			if (err.code == 422) {
				let o = {};
				err.data.forEach(e => {
					let field = e.field.split(".").pop();
					o[field] = e.message;
				});

				res.end(JSON.stringify({ errors: o }, null, 2));
			} else {
				const errObj = _.pick(err, ["name", "message", "code", "type", "data"]);
				res.end(JSON.stringify(errObj, null, 2));
			}
			this.logResponse(req, res, err? err.ctx : null);
		}

	},

	methods: {
		/**
		 * Authorize the request
		 *
		 * @param {Context} ctx
		 * @param {Object} route
		 * @param {IncomingRequest} req
		 * @returns {Promise}
		 */
		async authorize(ctx, route, req) {
			let token;
			if (req.headers.authorization) {
				let type = req.headers.authorization.split(" ")[0];
				if (type === "Token" || type === "Bearer")
					token = req.headers.authorization.split(" ")[1];
			}

			let user;
			if (token) {
				// Verify JWT token
				try {
					user = await ctx.call("users.resolveToken", { token });
					if (user) {
						this.logger.info("Authenticated via JWT: ", user.username);
						// Reduce user fields (it will be transferred to other nodes)
						ctx.meta.user = _.pick(user, ["_id", "username", "email", "image"]);
						ctx.meta.token = token;
						ctx.meta.userID = user._id;
					}
				} catch(err) {
					// Ignored because we continue processing if user is not exist
				}
			}

			if (req.$action.auth == "required" && !user)
				throw new UnAuthorizedError();
		}
	}
};
