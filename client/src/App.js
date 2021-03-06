/*
Copyright 2020 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

// Importing react-spectrum
import React from 'react';
import "regenerator-runtime/runtime.js";
import debug from 'debug';

// Importing react-spectrum components
import Well from '@react/react-spectrum/Well';
import Button from '@react/react-spectrum/Button';
import {Toast} from '@react/react-spectrum/Toast';
import Heading from '@react/react-spectrum/Heading';
import {Image} from '@react/react-spectrum/Image';
import {Accordion, AccordionItem} from '@react/react-spectrum/Accordion';
import {Grid, GridColumn, GridRow} from '@react/react-spectrum/Grid';
import Editor from './components/TextEditor/Editor';
import ChooseFileBox from './components/FileChooser/ChooseFileBox';
import Rendition from './components/RenditionDisplay/Rendition';
import logo from './images/Adobe_Experience_Cloud_logo_128px.png';

const Log = debug('asset-compute-devtool.App');
const DEFAULT_RENDITIONS_TEXT  = JSON.stringify({
    "renditions": [
        {
            "name": "rendition.xml",
            "fmt": "xmp"
        },
        {
            "name": "rendition.txt",
            "fmt": "txt"
        },
        {
            "name": "rendition.48.48.png",
            "fmt": "png",
            "width": 48,
            "height": 48
        },
        {
            "name": "rendition.319.319.png",
            "fmt": "png",
            "width": 319,
            "height": 319
        }
    ]
}, undefined, 4);

export default class NormalDisplay extends React.Component {

    constructor(props) {
        super(props);
        this.state= {
            running:false,
            renditions:[],
            rendNames:[],
            rendData:[],

            lastVal:'',
            oldStart:0,
            command:false,

            runTutorial:false,
            dev: localStorage.dev,
            env: localStorage.env,
            textArea: localStorage.getItem('json') || DEFAULT_RENDITIONS_TEXT,
            selectedOption: localStorage.selectedFile || null,
            devToolToken: this.getDevToolToken()
        };
        this.run = this.run.bind(this);
        this.handleTextChange = this.handleTextChange.bind(this);
        this.hideToast = this.hideToast.bind(this);
    }

    getDevToolToken() {
        try {
            return window.location.search.substring(1).split('=')[1];
        } catch (e) {
            // ignore if error getting dev tool token
        }
    }

    async callGetAssetComputeEndpoint() {
        if (this.isAborted) return;
        let resp;
        try {
            resp = await fetch("/api/asset-compute-endpoint", {
                method: 'GET',
                headers: {
                    Authorization: this.state.devToolToken
                }
            });
            if (!resp.ok) {
                const errorMessage = await this.formatErrorMessage(resp, 'Asset Compute Endpoint');
                throw new Error(errorMessage);
            }
            resp = await resp.json();
            Log(`Using Asset Compute endpoint: ${resp.endpoint}`);
            this.setState({
                endpoint: resp.endpoint
            });
            return resp.endpoint;
        } catch (e) {
            Log(e);
            this.handleApiErrors(e.message);
        }
    }

    componentDidMount() {
        this.callGetAssetComputeEndpoint();
    }

    hideToast() {
        this.setState({ error: undefined });
    }
    abort() {
        const message = "Processing has been aborted";
        this.setState({
            running: false,
            renditions: [],
            rendNames: [],
            rendData: [],
            json: null,
            logs: undefined,
            error: <Toast closable onClose={this.hideToast} variant="error">{message} </Toast>

        });

        this.isAborted = true;
    }

    async callPresignUrlApi(key) {

        if (this.isAborted) return;

        var resp;
        try {
            var data = new FormData();
            data.append('key', key);
            Log('calling Cloud Storage presign get');
            resp = await fetch("/api/cloudstorage-presign-get", {
                method: 'POST',
                headers: {
                    Authorization: this.state.devToolToken
                },
                body: data
            });
            if (!resp.ok) {
                const errorMessage = await this.formatErrorMessage(resp, '/presign-get')
                throw new Error(errorMessage);
            }
            resp = await resp.json();
            Log(`Successfully got presigned get url for ${key}, ${resp.url}`);
            return resp.url;
        } catch (e) {
            Log(e);
            return this.handleApiErrors(e.message);
        }
    }

    async callAssetComputeApi(source, renditions) {

        if (this.isAborted) return;

        var resp;
        try {
            var data = new FormData();
            data.append('source',source);
            data.append('renditions', JSON.stringify(renditions));
            Log('calling asset compute /process');
            resp = await fetch("/api/asset-compute-process", {
                method: 'POST',
                headers: {
                    Authorization: this.state.devToolToken
                },
                body: data
                });
            if (!resp.ok) {
                const errorMessage = await this.formatErrorMessage(resp, '/process')
                throw new Error(errorMessage);
            }
            resp = await resp.json();
            return resp;
        } catch(e) {
            Log(e);
            return this.handleApiErrors(e.message);
        }
    }

    async callAssetComputeEventsApi(requestId) {

        if (this.isAborted) return;

        var resp;
        try {
            var data = new FormData();
            data.append('requestId', requestId);
            Log(`getting events for requestId: ${requestId}`);
            resp = await fetch("/api/asset-compute-get-events", {
                method: 'POST',
                headers: {
                    Authorization: this.state.devToolToken
                },
                body: data
            });
            if (!resp.ok) {
                const errorMessage = await this.formatErrorMessage(resp, '/get-events')
                throw new Error(errorMessage);
            }
            resp = await resp.json();
            Log(`Successfully got events ${JSON.stringify(resp, undefined, 1)}`);
            return resp;
        } catch (e) {
            Log(e);
            return this.handleApiErrors(e.message);
        }
    }

    async callOpenWhiskLogsApi(activationId, events) {

        if (this.isAborted) return;

        var resp;
        try{
            var data = new FormData();
            data.append('activationId', activationId);
            data.append('events', JSON.stringify(events));
            resp = await fetch("/api/openwhisk-activationLogs", {
                method: 'POST',
                headers: {
                    Authorization: this.state.devToolToken
                },
                body: data
                });
            if (!resp.ok) {
                const errorMessage = await this.formatErrorMessage(resp, '/activationLogs')
                throw new Error(errorMessage);
            }
            resp = await resp.json();
            Log(`Successfully got activation logs`);
            return resp;
        } catch(e) {
            Log(e);
            return this.handleApiErrors('Error getting OpenWhisk activation logs');
        }
    }

    handleApiErrors(message, running=false) {
        if (!this.state.error) {
            this.setState(
                {
                    error: <Toast closable onClose={this.hideToast.bind(this)} variant="error">{message} </Toast>
                }
            );
        }
    }

    // Attempt to read error message if it is formatted properly
    async formatErrorMessage(resp, api) {
        try {
            return (await resp.json()).message;
        } catch (e) {
            // ignore if response is not JSON formatted and use default error message instead
            return `Error fetching ${api}: ${resp.status} ${resp.statusText}`;
        }
    }

    formatActivationLogs(logs) {
        // used to format the width for the activation logs
        if (!this.isAborted && logs) {
            const currentWidth = document.getElementById('activationLogs').offsetWidth;
            const headings = logs.map(log => {
                Log('log: ', log);
                return <span>
                    <br />
                    <Heading variant="subtitle2">>>>>>>>>>>> Start of Activation Id: {log.activationId}</Heading>
                    <code >{log.logs}</code>
                    <Heading variant="subtitle2">>>>>>>>>>>> End of Activation Id: {log.activationId}</Heading>
                    <br />
                </span>
            });
            return <pre style={{ maxHeight: '400px', overflow: 'scroll', maxWidth: `${currentWidth - 20}px`, fontSize: '12px' }}>{headings}</pre>
        }
        return;
    }

    formatRequestDisplay(response={}) {
        const currentWidth = document.getElementById('activationLogs').offsetWidth;
        return <pre style={{ maxHeight: '400px', overflow: 'scroll', maxWidth: `${currentWidth - 20}px`, fontSize: '12px' }}>
                <Heading size={6}>Request:</Heading>{`POST ${this.state.endpoint}/process\n`}
                <br/>{JSON.stringify(response.request, undefined, 1)}<br/>
                <br/>
                <Heading size={6}>Response:</Heading>
                {JSON.stringify(response.response, undefined, 2)}
            </pre>
    }

    async checkJournalReady() {
        if (this.isAborted) return;
        let resp;
        try {
            resp = await fetch("/api/check-journal-ready", {
                method: 'GET',
                headers: {
                    Authorization: this.state.devToolToken
                }
            });
            resp = await resp.json();
            return resp.isReady;
        } catch(e) {
            Log(e);
            return this.handleApiErrors(e.message);
        }
    }

    async run() {
        this.isAborted = false;
        this.setState({
            renditions: [],
            error: null,
            runTutorial: false,
            running: true,
            logs: undefined
        });
        //validate if journal ready
        if(!this.state.journalReady){
            const isJournalReady = await this.checkJournalReady();
            this.setState({
                journalReady: isJournalReady
            });
            if(!isJournalReady) {
                const errMsg = 'Adobe I/O Event provider journal setup in progress. Please try again after 1 min';
                Log(errMsg);
                return this.handleApiErrors(errMsg);
            }
        }
        // name all the renditions and create presigned put urls
        try {
            const requestJSON = JSON.parse(this.state.textArea);
            const source = this.state.selectedOption;
            const response = await this.callAssetComputeApi(source, requestJSON.renditions);
            const renditions = [];

            Log("Response from /process:", JSON.stringify(response, null, 2));
            if (!response || !response.response) {
                return; // process failed so just return
            }

            if (!this.isAborted) {
                const jsonResponse = this.formatRequestDisplay(response);
                this.setState({
                    json: jsonResponse,
                    renditions: Array(requestJSON.renditions.length + 1).join('0').split('').map(parseFloat)
                });
            }

            const events = await this.callAssetComputeEventsApi(response.response.requestId);

            if (this.isAborted) return;
            await Promise.all(events.map(async event => {

                if (event.type === "rendition_created") {
                    // get presigned url for event.rendition.name
                    const presignURL = await this.callPresignUrlApi(event.rendition.userData.path);

                    if (!this.isAborted) {
                        renditions.push({
                            name: event.rendition.name,
                            url: presignURL,
                            fmt: event.rendition.fmt
                        });
                    }
                } else {
                    if (!this.isAborted) {
                        renditions.push({
                            name: event.rendition.name,
                            fmt: event.rendition.fmt,
                            errorMessage: event.errorMessage,
                            errorReason: event.errorReason
                        });
                    }
                }
            }));

            if (this.isAborted) return;

            this.setState({
                running:false,
                renditions: renditions,
                activationId:response.activationId
            });

            const logs = await this.callOpenWhiskLogsApi(response.activationId, events);
            const formatedLogs = this.formatActivationLogs(logs);

            if (!this.isAborted && formatedLogs) {
                this.setState({
                    logs: formatedLogs
                });
            }
        } catch(err) {
            this.setState({
                running:false
            });
            Log(err);
            return this.handleApiErrors('Unexpected error. Check source file or request JSON.');
        }
    }

    handleTextChange(v) {
        this.setState({textArea: v});
    }

    handleSelectedFileChange(f) {
        this.setState({selectedOption:f});
        localStorage.setItem('selectedFile', f);
        Log('selected file changed', this.state.selectedOption, f)
    }

    render() {
        var main =
        <Grid id="main">
            <GridRow>
                <GridColumn size="auto">
                <div  style={{ marginTop:'53px',
                            minWidth: '500px', marginBottom: '1em',
                            padding: '1rem'}}>
                        {/* choose file and add new file */}
                        <ChooseFileBox id="ChooseFileBox" onChange={this.handleSelectedFileChange.bind(this)} devToolToken={this.state.devToolToken} onError={this.handleApiErrors.bind(this)}/>
                        <Button id="run" label="Run" variant="cta" style={{marginTop:15, marginLeft:10}} disabled={!this.state.selectedOption || this.state.running} onClick={this.run}/>
                        <span id="tourStepThree" style={{position:"fixed", top:'35px', left:'420px'}}/>
                        <Button id='Abort' label="Abort" variant="warning" style={{marginTop:15, marginLeft:10}} disabled={!this.state.running} onClick={this.abort.bind(this)}/>

                        <Editor onChange={(v) => {this.handleTextChange(v)}} devToolToken={this.state.devToolToken} onRun={this.run}/>

                    </div>
                </GridColumn>
                <GridColumn size="auto">
                <div  style={{ marginTop:'53px',
                            position: 'relative',
                            minWidth: '400px',
                            marginBottom: '1em',
                            padding: '1rem'}}>
                    <Accordion>
                        <AccordionItem  header="Request/Response" disabled={!this.state.json}>
                            <div style={{paddingTop:'30px'}}>{this.state.json}</div>
                        </AccordionItem>
                    </Accordion>
                    <Accordion id='activationLogs'>
                        <AccordionItem  header="Activation Logs" disabled={!this.state.logs}>
                                {this.state.logs}
                        </AccordionItem>
                    </Accordion>
                    <Well style={{marginTop:40}}>
                        <Heading size={5}>Renditions</Heading>
                        <Rendition renditions={this.state.renditions} metadata={this.state.rendData} names={this.state.rendNames}/>
                    </Well>
                </div>
                </GridColumn>
            </GridRow>
        </Grid>
        return (
        <div >
            <title>Adobe Asset Compute</title>
            <ul className="top-bar">
                <Image id='Adobe Experience Cloud Logo' style={{width:'32px', height:'32px', position:'fixed', marginTop:'10px'}} alt='Adobe Experience Cloud Logo' src={logo}/>
                <Heading variant="pageTitle" style={{position:"fixed", left:'60px', marginTop:'5px'}}>Adobe Asset Compute</Heading>
            </ul>
        {main}
        <p style={{marginRight:300, marginLeft:20, bottom:4, position:'fixed'}}>{this.state.error}</p>
        </div>
        )
    }
}
