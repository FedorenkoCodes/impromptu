import "./App.css"
import { VscodeBadge, VscodeTabs, VscodeTabHeader, VscodeTabPanel } from "@vscode-elements/react-elements"

export function App() {
    return (
        <>
            <h1>Parcel React App!!!</h1>
            <p>
                Edit <code>src/App.tsx</code> to get started!
            </p>
            <VscodeBadge>308 Settings Found</VscodeBadge>

            <VscodeTabs selected-index="1">
                <VscodeTabHeader slot="header">Lorem</VscodeTabHeader>

                <VscodeTabPanel>
                    <p>Lorem ipsum dolor...</p>
                </VscodeTabPanel>

                <VscodeTabHeader slot="header">
                    Ipsum
                    <VscodeBadge variant="counter" slot="content-after">
                        2
                    </VscodeBadge>
                </VscodeTabHeader>

                <VscodeTabPanel>
                    <p>Aliquam malesuada rhoncus nulla...</p>
                </VscodeTabPanel>

                <VscodeTabHeader slot="header">Dolor</VscodeTabHeader>

                <VscodeTabPanel>
                    <p>Nulla facilisi. Vivamus...</p>
                </VscodeTabPanel>
            </VscodeTabs>
        </>
    )
}
