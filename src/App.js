import React, { Component } from 'react';
import './App.css';
import IBLayoutWrapper from './Components/IBLayoutWrapper';
import RelValLayoutWrapper from './Components/RelValLayoutWrapper';
import { Routes, Route, Navigate } from "react-router-dom";
import { config } from './config';
import { getSingleFile } from "./Utils/ajax";
import { Container } from "react-bootstrap";
import { RelValProvider } from './Stores/RelValStore';
import { ShowArchProvider } from './context/ShowArchContext';
import { CommandProvider } from './context/CommandContext';
import { ExitCodeProvider } from './context/ExitCodeContext';
import { ChatProvider } from './context/ChatContext';
import ShiftConsolePage from './Components/ShiftConsole/ShiftConsolePage';


const { urls } = config;

class App extends Component {
  constructor() {
    super();
    this.state = {
      structure: {
        all_prefixes: []
      },
    };
  }

  componentDidMount() {
    getSingleFile({
      fileUrl: urls.releaseStructure,
      onSuccessCallback: (response) => {
        this.setState({ structure: response.data });
      }
    });
  }

  defaultPage() {
    const ib = "/ib/";
    if (this.state.structure.default_release) {
      return ib + this.state.structure.default_release;
    } else if (this.state.structure.all_prefixes.length > 0) {
      const lastPrefix = this.state.structure.all_prefixes.length - 1;
      return ib + this.state.structure.all_prefixes[lastPrefix];
    } else {
      return ib;
    }
  }

  static errorWrongRoute = (
    <Container className="p-5 my-5 bg-light text-center rounded">
      <h1>Incorrect route specified</h1>
      <p>The route needs to be "/release_date/release_que"</p>
    </Container>
  );

  static containerWrapper(content) {
    return <div className="container">{content}</div>;
  }

  render() {
    if (this.state.structure.all_prefixes.length === 0) {
      return <div />;
    }

    // WRAP EVERYTHING IN PROVIDERS
    return (
    <ChatProvider>
      <ExitCodeProvider>
        <CommandProvider>
          <ShowArchProvider>
            <RelValProvider>
              <Routes>
                <Route
                  path="/"
                  element={<Navigate to={this.defaultPage()} replace />}
                />
                <Route
                  path="/ib/:prefix"
                  element={
                    <IBLayoutWrapper
                      toLinks={this.state.structure.all_prefixes}
                      structure={this.state.structure}
                    />
                  }
                />
                <Route
                  path="/relVal/:que/:date"
                  element={<RelValLayoutWrapper />}
                />
                <Route
                  path="/shift"
                  element={<ShiftConsolePage />}
                />
                <Route
                  path="*"
                  element={App.containerWrapper(App.errorWrongRoute)}
                />
              </Routes>
            </RelValProvider>
          </ShowArchProvider>
        </CommandProvider>
      </ExitCodeProvider>
    </ChatProvider>
    );
  }
}

export default App;