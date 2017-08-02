#     MXControl
#### Basic Automatic and Scheduled Power Controls for Very Basic AWS Environments

### Why do I want this?
You're a hobbyist, small business, or early stage start-up with one or more simple environments consisting of either single instances or single-frontend/single-backend/single-db setups in AWS EC2/RDS, and you want simplified controls for the power state of your environments for both ease and major $$$ savings on your AWS bill.

...or because you're a dev at MASS and Ops told you to do so.

### Okay... but what does it do?

Do you need to:
 - Shut down, start up, reboot, or resize some AWS EC2 or RDS instances over a cli quickly without dealing with the overly verbose syntax of the aws-cli?
 - Quickly check on the addresses or state of your instances without kludging around the monolithic AWS GUI?
 - Schedule instances to do these tasks automatically?

Well, this does those things.

### Setup

#### Part 1: Get MXControl
- Clone this repo and run `npm install` inside it to set up necessary libraries.
- Provide the following as environment variables (depending on your OS, as `export` statements in your `~/.bashrc`, `~/.zshrc` or `profile`, or inside administrative settings in Windows):
    - `awsAccessKeyId`: the ID of the aws credential.
    - `awsSecretAccessKey`: the credential's key
    - `awsRegion`: the aws region being operated on.
- Run `npm link` to symlink the package to your installation of npm's `PATH` directory, making it invokable from your shell.

#### Part 2: Configure some defaults, and organize your environment naming scheme for MORE CONTROL!
- First, doublecheck default sizes included in `dbPowerDefaults.json`. Amazon RDS, at least at the time of writing, lacks an off state for their database offering. Because of this lack of an off switch, **all power toggling of RDS instances in MXControl are actually resizes.** If you want to change the default up or down size, this is where you'd do it.

- **For singular instance/database jobs, naming scheme configurations isn't important to MXControl whatsoever.** However, if you want to designate a frontend-backend pair of EC2 instances bundled with an RDS database as an 'environment' to be controlled as a single unit together, do the following:
    - change the names of your instances in AWS to follow the scheme `$PREFIX$ENVNAME`, and give any EC2 instances to be contained in the environment the tag `Key: Environment, Value: $ENVNAME.` RDS instances only need to be named, not tagged. This is due to an AWS API eccentricity that may be cleared up at a later time. Then edit `instanceNamePrefixes.json` to include your prefixes.

    - **For example**, with the configured prefixes `CompanyFrontend-`, `CompanyBackend-`, and `CompanyDB-`, EC2 instances with the tag `Environment: demo` and named `CompanyFrontend-demo`/`CompanyBackend-demo` as well as any RDS instance named `CompanyDB-demo` will be controllable as a single unit designated 'demo.'
- Lastly, just to make sure things are set up right, try:
```bash
mxcontrol status --env
```
If everything is set up right on your end, this should have outputted information about all your deployed RDS and EC2 instances in the `awsRegion` you supplied as environment variables, in JSON.

#### Part 3: GO!
**After configuring, you should be able to perform simple, on-demand power operations and status checks via the MXControl CLI as well as through its scheduled task runner. **

### CLI Syntax
```bash
mxcontrol ACTION [--MODE] TARGET [--size TARGETSIZE]
```

- **ACTION:** Either on, off, restart, resize, help, status, or cron.
- If action is resize, you must also include the `--size` flag and include which size the instance should be.
- Alternate action terms, like up, down, reboot, and auto also work, as to make life easier.
- Resize actions for full environments are disallowed. For that functionality, simply make multiple single instance calls.

- **MODE:**
   - `--inst` (individual EC2 instance),
   - `--env` (EC2 Environment tag group)
   - `--db` (RDS instance)
- **TARGET:** Either an environment name, instance name, or database identifier, depending on **MODE** flag

- **IF AUTO/CRON OR HELP ARE GIVEN AS THE ACTION, MODE AND TARGET ARE UNNECESSARY**


Alternatively, arrays of targets of the same type **and of the same type only** can be operated on using:
```bash
mxcontrol ACTION [--MODE] TARGET [--SAMEMODE] TARGET2 [--SAMEMODE] TARGET-N [--size TARGETSIZE]
```

### CLI Examples

```bash
mxcontrol up --env demo
```
Turns on any instances and resizes any databases to their "up" size  with an Environment tag equal to `demo`.
___
```bash
mxcontrol status --inst MXUtil
```
Prints out status information for an instance named `MXUtil`. For best results, pipe into other scripts such as underscore-cli's `underscore pretty`
___
```bash
mxcontrol reboot --inst MXWeb-app
```
Reboots the instance named `MXWeb-app`
___
```bash
mxcontrol resize --db mxenvironment-qa --size db.t2.medium
```
Resizes the database `mxenvironment-qa` to `db.t2.medium`
___
```bash
mxcontrol auto
```
Reads the file `cronTaskList.json` in the mxcontrol directory, and performs any specified tasks over the specified schedule.
___
```bash
mxcontrol status --env
```
Prints out any status information for ALL RDS and EC2 instances. Currently, only status calls have blank-as-wildcard support, for everyones safety.
___
```bash
mxcontrol info --inst
```
Prints out any status information for ALL EC2 instances. Info is interchangable with status.
___
```bash
mxcontrol status --db
```
Prints out any status information for ALL RDS instances.
___
```bash
mxcontrol help
```
Prints this help text. May want to pipe it through less for readability.

### ControlTask Syntax
##### (For scheduled tasks configured in `cronTaskList.json` and other future planned input sources using JSON)

 - Essentially, its very similar to the CLI syntax, just expressed in JSON.
 - Each ControlTask is a Javascript Object with a string `action`, a target `instance`, `environment`, or `database`, which can either be a string or an array of strings.
 - For scheduled tasks, a `time` is also required, specified as a cron-formatted string, or in simple english.
 - For more information on the expected simple english time syntax, please see the [Later.js Text Parser Manual](https://bunkat.github.io/later/parsers.html#text).
 - To run these ControlTasks using the scheduled tasks feature, first populate `cronTaskList.json` with an array of ControlTasks, then run `mxcontrol auto` in the background. As long as `mxcontrol auto` is running, the tasks defined in `cronTaskList.json` at the time of execution should be occurring.

### ControlTask Examples
```json
{
    "environment": "demo",
    "action": "up"
}
```
Turns on any instances and resizes any databases to their "up" size  with an Environment tag equal to `demo`.
**Note:** this example would be rejected by the scheduled task system, but would probably be an acceptable ControlTask for immediate execution in future functionality.
___

```json
{
    "instrument": "MXWeb-app",
    "action": "reboot",
    "time": "00 30 7 * * *"
}
```
Reboots the instance named `MXWeb-app` at 7:30 AM every day.
___
```json
{
    "database": "mxenvironment-qa",
    "action": "resize",
    "size": "db.t2.medium",
    "time": "every weekday at 7:30 PM of October in 2017"
}
```
Resizes the database `mxenvironment-qa` to `db.t2.medium` every weekday (Monday - Friday) in October at 7:30 PM in 2017.

**Again, for more information regarding simple english time syntax, please see the [Later.js Text Parser Manual](https://bunkat.github.io/later/parsers.html#text).**

### Implementation Notes for Future Maintainers

##### KNOWN IMPLEMENTATION QUIRKS:
- Database lookups in environment-targeted calls solely use their (hopefully) properly formatted database identifier, rather than the combination of name and environment tag. Getting DB tags is different than for EC2, and someone may put in the work towards that later.

- Times given to Later.js are currently forced to UTC for consistency reasons. Timezones (like NYC aka EST/EDT) can be supported again easily, but time is of the essence.

##### ASSOCIATED REPOSITORIES:

- **MXAWS:** MassExchange's repository of simplified AWS wrappers w/ environment variable based IAM automatic authentication provides all the functionality for
this code to interact with AWS. It can be found [here](https://github.com/massexchange/MXAWS).

##### FILES INCLUDED:
(file extension, then alphabetical order)

- **AWSEC2Sizes.json:** A JSON list of every possible AWS size, built using copy, paste, cat, and underscore-cli. In the future, we may want to fetch this list automatically/update it dynamically. **DO NOT EDIT, unless to update or eliminate.**

- **cronTaskList.json:** A user supplied JSON list of controlTask objects. Read whenever `mxcontrol auto` is invoked. An nonsense example is included by default.

- **dbPowerDefaults.json:** A JSON object designating the desired default sizes for `on` and `off` RDS states. Sensible defaults are included.

- **instanceNamePrefixes.json:** A JSON object designating instance name prefixes for your back end, front end, and database instances.

- **cli.js:** Arbitrates any activities involving command line interactions with **MXControl**. Essentially, takes command line arguments, passes it to [minimist](https://github.com/substack/minimist), forms the resulting minimist argument object into an unvalidated ControlTask, passes the created task into controlTaskValidator.js to validate the object and get any errors. If there are no errors, passes the validated task to **routes.js's** `runTask` function.

- **cronPower.js:** Arbitrates any activities involving scheduling tasks via file input (can be easily refactored in the future to accept any JSON input for scheduled jobs) with [Later.js](https://bunkat.github.io/later/index.html) and **MXControl.** It reads the file **cronTaskList.json,** attempts to parse it for JSON, passes said resulting JSON to controlTaskValidator. If there are no errors, it then uses **routes.js's** `buildPowerFunc` to build a `runTask` wrapper function to run over a valid Later.js schedule.

- **logUtil.js:** Utility functions and object definitions specifically centered around printing logs using [winston](https://github.com/winstonjs/winston).

- **controlTaskValidator:** Provides any and all functionality needed for validating ControlTasks, but not for validating specific types of input, like command line arguments. Before any ControlTask can get safely passed into **routes.js's** `runTask`, it must pass through `getControlTaskErrors`. If this function returns no tasks in error, then it is safe to run.

- **mxcontrolUtil.js:** Any other utility functions or constant definitions needed in more than one file, and not covering logging. Maintains dictionaries of `possibleActions` and `possibleSizes`, `tryToParseConfig,` for safely parsing configurations, and other minor functionality.

- **routes.js:** Provides all decisioning functionality, as well as wrappers for getting simplified AWS state object arrays. Primarily, provides `runTask`, which, given a well-formed ControlTask, runs a specified **[MXAWS](https://github.com/massexchange/MXAWS)**. function or series of functions, and `buildPowerFunc`, which returns argument-less functions that call `runTask` with a packaged, well-formed ControlTask.
