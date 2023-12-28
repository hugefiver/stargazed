#!/usr/bin/env node

/**
 *  stargazed
 *
 *  @author   abhijithvijayan <abhijithvijayan.in>
 *  @license  MIT License
 */

import { flags } from "./index/cli";
import Spinner from "./shared/spinner";
import { flashError } from "./shared/message";
import { options, validate } from "./index/validate";
import { handleRepositoryActions, setUpWorkflow } from "./index/repo";
import { writeReadmeContent, buildReadmeContent, generateStargazedList, fetchUserStargazedRepos } from "./index/stargazed";

// init network proxy
import { bootstrap } from "global-agent";
bootstrap();
global.GLOBAL_AGENT.HTTP_PROXY = process.env.HTTP_PROXY || process.env.http_proxy;
global.GLOBAL_AGENT.HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.https_proxy;

(async () => {
	const err = validate(flags);

	if (err) {
		flashError(err);
		return;
	}

	const { username, token = "", sort, repo, workflow } = options;

	if (!username) {
		flashError("Error! username is a required field.");
		return;
	}

	let githubAction = false;
	let cronJob = false;

	if (repo) {
		if (!token) {
			flashError("Error: creating repository needs token. Set --token");
			return;
		}

		if (workflow) {
			cronJob = true;
		}

		githubAction = true;
	}

	// Trim whitespaces
	if (typeof String.prototype.trim === "undefined") {
		String.prototype.trim = () => {
			return String(this).replace(/^\s+|\s+$/g, "");
		};
	}

	const spinner = new Spinner("Fetching stargazed repositories...");
	spinner.start();

	// get data from github api
	const { list = [] } = await fetchUserStargazedRepos({
		spinner,
		options,
	});

	spinner.succeed(`Fetched ${Object.keys(list).length} stargazed items`);
	spinner.stop();

	let unordered = {};
	const ordered = {};

	// Generate list
	if (Array.isArray(list)) {
		unordered = await generateStargazedList(list);
	}

	// Sort to Languages alphabetically
	if (sort) {
		Object.keys(unordered)
			.sort()
			.forEach((key) => {
				ordered[key] = unordered[key];
			});
	}

	const languages = Object.keys(sort ? ordered : unordered);
	const readmeContent = await buildReadmeContent({
		// array of languages
		languages,
		// Total items count
		count: Object.keys(list).length,
		// Stargazed Repos
		stargazed: sort ? ordered : unordered,
		username,
		date: `${new Date().getDate()}--${new Date().getMonth() + 1
			}--${new Date().getFullYear()}`,
	});

	// Write Readme Content locally
	await writeReadmeContent(readmeContent);

	//  Handles all the repo actions
	if (githubAction) {
		await handleRepositoryActions({
			readmeContent: unescape(readmeContent),
			options,
		});
	}

	// Setup GitHub Actions for Daily AutoUpdate
	if (cronJob) {
		await setUpWorkflow(options);
	}
})();
