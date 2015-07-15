/*
 * Copyright 2015 Michael Nye <thenyeguy@gmail.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met: 
 * 
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer. 
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution. 
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

"use strict";

(function(Nuvola)
{

    // Create media player component
    var nuvolaPlayer = Nuvola.$object(Nuvola.MediaPlayer);

    // Handy aliases
    var PlaybackState = Nuvola.PlaybackState;
    var PlayerAction = Nuvola.PlayerAction;

    // Create new WebApp prototype
    var WebApp = Nuvola.$WebApp();

    // Initialization routines
    WebApp._onInitWebWorker = function(emitter)
    {
        Nuvola.WebApp._onInitWebWorker.call(this, emitter);

        /*
         * Spotify fails to load when localStorage["indexeddb"] is true and shows only logo and background.
         * Let's remove this item! See issue https://github.com/tiliado/nuvolaplayer/issues/82
         * You can use `localStorage["indexeddb"] = true;` for testing ;-)
         */
        window.localStorage.removeItem("indexeddb");
        
        var state = document.readyState;
        if (state === "interactive" || state === "complete")
            this._onPageReady();
        else
            document.addEventListener("DOMContentLoaded",
                    this._onPageReady.bind(this));

    }

    // Page is ready for magic
    WebApp._onPageReady = function()
    {
        // Connect handler for signal ActionActivated
        Nuvola.actions.connect("ActionActivated", this);

        this.connect();
    }

    // Connects to the Spotify hooks and starts updates
    WebApp.connect = function()
    {
        // It takes some time for Spotify webapp to fully load, so we keep
        // trying to get the player until it succeeds
        var context = window.Spotify.Shuttle._initContext;
        if(context)
        {
            this.spotifyPlayer = context.contextPlayer;
            this.reset();
            this.update();
        }
        else
        {
            setTimeout(this.connect.bind(this), 100);
        }
    }

    // Wipe the current playstate
    WebApp.reset = function() {
        var track = {
            title: null,
            artist: null,
            album: null,
            artLocation: null
        };
        nuvolaPlayer.setTrack(track);
        nuvolaPlayer.setPlaybackState(PlaybackState.UNKNOWN);

        nuvolaPlayer.setCanPlay(false);
        nuvolaPlayer.setCanPause(false);
        nuvolaPlayer.setCanGoNext(false);
        nuvolaPlayer.setCanGoPrev(false);
    }

    // Get the current Spotify state and update Nuvola
    WebApp.update = function()
    {
        this.spotifyPlayer.getPlayerState().then(function (result) {
            var song = result.trackState.track;
            var playing = result.playbackState.playing;
            if(song)
            {
                this.updateTrack(song);
                this.updateState(playing);
            }
            else
            {
                this.reset();
            }
        }.bind(this));
        setTimeout(this.update.bind(this), 500);
    }

    // Update the currently playing track
    WebApp.updateTrack = function(song)
    {
        var track = {
            title: song.name,
            artist: song.artistName,
            album: song.albumName,
            artLocation: song.image
        };
        nuvolaPlayer.setTrack(track);
    }

    // Update state and available actions
    WebApp.updateState = function(playing) {
        var state = playing ? PlaybackState.PLAYING : PlaybackState.PAUSED;
        nuvolaPlayer.setPlaybackState(state);

        nuvolaPlayer.setCanPlay(!playing);
        nuvolaPlayer.setCanPause(playing);

        if(this.spotifyPlayer._loadedContextList)
        {
            this.spotifyPlayer._loadedContextList.hasNext().then(
                    function (result) {
                nuvolaPlayer.setCanGoNext(result);
            });
            this.spotifyPlayer._loadedContextList.hasPrevious().then(
                    function (result) {
                nuvolaPlayer.setCanGoPrev(result);
            });
        }
    }

    // Handler of playback actions
    WebApp._onActionActivated = function(emitter, name)
    {
        switch(name)
        {
            case PlayerAction.TOGGLE_PLAY:
                this.spotifyPlayer.togglePlay();
                break;
            case PlayerAction.PLAY:
                this.spotifyPlayer.resume();
                break;
            case PlayerAction.PAUSE:
                this.spotifyPlayer.pause();
                break;
            case PlayerAction.STOP:
                this.spotifyPlayer.stop();
                break;
            case PlayerAction.PREV_SONG:
                this.spotifyPlayer.previous("backbtn");
                break;
            case PlayerAction.NEXT_SONG:
                this.spotifyPlayer.next("fwdbtn");
                break;
            default:
                throw {"message": "Not supported."};
        }
    }

    WebApp.start();
})(this);
