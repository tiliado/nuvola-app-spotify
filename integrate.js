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

        // Hook into Spotify globals
        if(!window.Spotify.Shuttle._initContext) return;
        this.context = window.Spotify.Shuttle._initContext;
        this.spotifyPlayer = this.context.contextPlayer;
        this.appManager = this.context.applicationManager;

        this.update()
    }

    WebApp.reset = function() {
        var track = {
            title: null,
            artist: null,
            album: null,
            artLocation: null
        };
        this.setTrack(track);
        this.setPlaybackState(PlaybackState.UNKNOWN);
    }

    // Update all the Nuvola state
    WebApp.update = function()
    {
        this.updateTrack();
        setTimeout(this.update.bind(this), 500);
    }

    // Get the current song state and update
    WebApp.updateTrack = function()
    {
        this.spotifyPlayer.getPlayerState().then(function (result) {
            var song = result.trackState.track;
            if (!song) this.reset();

            var track = {
                title: song.name,
                artist: song.artistName,
                album: song.albumName,
                artLocation: song.image
            };
            var state = result.playbackState.playing ?
                    PlaybackState.PLAYING : PlaybackState.PAUSED;

            nuvolaPlayer.setTrack(track);
            nuvolaPlayer.setPlaybackState(state);
        }
    }

    // Update available actios based on context
    WebApp.updateActions = function() {
        var playing = !!this.spotifyPlayer._currentTrack;
        nuvolaPlayer.canPlay(playing);
        nuvolaPlayer.canPause(!playing);
        this.spotifyPlayer._loadedContextList.hasNext().then(function (result) {
            nuvolaPlayer.canGoNext(result);
        });
        this.spotifyPlayer._loadedContextList.hasPrev().then(function (result) {
            nuvolaPlayer.canGoPrev(result);
        });
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
                this.spotifyPlayer.play();
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
