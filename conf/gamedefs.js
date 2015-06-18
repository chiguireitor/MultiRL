/*
 * gamedefs.js - Configuration file for Ganymede Gate
 *
 * Code style:
 * 4 space indents, no semicolons to finish lines, camelCase, opening braces on same line
 *
 * Created by John Villar for the "Ganymede Gate" sci-fi multiplayer roguelike
 * http://ganymedegate.com
 * Twitter: @johnvillarz
 * Reddit: /u/chiguireitor
 * Google Plus: +JohnVillar
 *
 * Like this! Follow me on social networks & send some Bitcoin my way if you want ;)
 *
 * BTC: 1kPp2CNp1xs7hf8umUwdp4HYiZ9AH1NVk
 *
 * // Beginning of license //
 *
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 John Villar
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * // End of license //
 *
 */
 
module.exports = {
    minPlayers: 1, // How many players must be connected to start the game
    continuousTurns: false, // If true, turns will pass automatically according to "continuousThresholdMillis"
    continuousThresholdMillis: 0,  // Milliseconds before a continuous turn ends, must be increments of 100ms, 0 for "instantaneous" turns
    spyIdleCounter: 3, // How much turns does the spy need to be idle to dissapear
	turnsForStep: 5,
    plasmaDamage: 15,
    lavaDamage: 5,
    acidDamage: 1,
    allowCheating: false,
    spawnPoolMaxRadius: 8,
    playerBaseFov: 10, // WARNING: too high a value can hog all the server bandwidth
    level: {
        width: 128,
        height: 64,
        minRoomArea: 36, // Minimum squared area of a room to be accepted
        randomAcceptRoom: 0.05, // Random probability of accepting a non-conforming room
        roomAcceptProbability: 0.4, // Once accepted, there's some probability we don't use that room
        roomConvertCaveProbability: 0.3, // There's also some probability the room is converted into a cave
        maxRivers: 6, // Max number of rivers, can be of water, acid or lava
        minLevers: 20, // Minimum number of levers in the level
        randomLevers: 4, // Max random number of levers to add to the level
        minNumberItems: 5,
        randomNumberItems: 5, // This gets multiplied by the level number
        numSpritesToTryFit: 20, // How much sprites the level generator will try to fit
        numEnemies: 50, // Number of enemies to keep alive at all times
    }
}