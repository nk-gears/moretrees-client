// import { Table } from 'react-bootstrap';

import styled from 'styled-components'
import Modal from 'react-modal'
import React from 'react';
import { useState, useContext, useEffect, useRef } from 'react'
import { StripeProvider } from 'react-stripe-elements-universal';
import { withRouter } from "react-router-dom";
import lodash from 'lodash'
import ReactMarkdown from 'react-markdown'
import {Collapse, UnmountClosed} from 'react-collapse';

import Input from './Input';
import Button from './Button';
import Counter from './counter'
import { STRIPE_PUBLIC_KEY, DONATION_MUTATION, GET_SAPLING_OPTIONS, PAGES } from '../constants';
import Checkout from './checkout/Checkout';
import gql from 'graphql-tag';
import useMutationApi from './hooks/useMutationApi';
import useQueryApi from './hooks/useQueryApi';
import { showToast, apiCallbackStatus } from '../utils';
import UserContext from './UserContext';

import donateLogoImage from '../images/moretrees-donate-logo.png'
import projectsLogoImage from '../images/moretrees-projects-logo.png'
import roadProjectsLogoImage from '../images/moretrees-road-projects-logo.png'
import riverProjectsLogoImage from '../images/moretrees-river-projects-logo.png'

const DONATION = 'donation'

const PAYMENT_CONFIRMATION = 'paymentConfirmation'
const PAYMENT_SUCCESS = 'paymentSuccess'

const MIN_DONATION_VALUE = 50

const customStyle = (caseForStyle) => {
    let customPadding = '20px 20px 0 20px'
    if (caseForStyle === PAYMENT_SUCCESS)
        customPadding = '20px'
    let style = {
        content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            borderRadius: '30px',
            padding: customPadding,
            border: '0px',
            boxShadow: '3px 3px 5px 6px #ccc'
        },
        overlay: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.95)'
        }
    }

    return style

}

const Donate = styled.div`
    margin: 10px;
`

const DonateTrees = styled.div`
    text-align: center;
`
const DonateItemsContainer = styled.div`
    display: inline-block;
`
const DonateItem = styled.div`
    flex-direction: column;
    display: flex;
    margin-top: 12px;
    border-bottom: 1px solid grey;
    box-shadow: 0 4px 6px -6px #222;
`

const ItemContainer = styled.div`
    display: flex;
    flex-direction: row;
    @media all and (max-width: 900px) {
        flex-direction: column;
    }
`

const ItemDetail = styled.div`
    margin: 0px 60px 25px 20px;
    font-family: "Trebuchet MS", Helvetica, sans-serif;
    white-space:nowrap;
    display: flex;
    flex-direction: column;
`

const ItemTitle = styled.span`
    text-align: left;
    @media all and (max-width: 900px) {
        text-align: center;
    }
    font-weight: bold;
    font-size: 22px;
    margin: 10px 10px 0px 10px;
`

const ItemSubtitle = styled.div`
    text-align: left;
    @media all and (max-width: 900px) {
        text-align: center;
    }
    margin: 10px 10px 0px 10px;
`

const ItemCost = styled(ItemSubtitle)`
    font-weight: bold;
    font-size: 18px;
    width: 160px;
`

const CostContainer = styled.div`
    display: flex;
    @media all and (max-width: 900px) {
        align-self: center;
    }
`


const Subtotal = styled.div`
    width: 50%;
    margin: auto;
`
const Section = styled.div`
        display: flex;
        flex-direction: row;
    `
const DonatePicture = styled.div`
        width: 40px;
        height: 40px;
        margin: 10px;
    `

const Container = styled.div`
        display: flex;
        flex-direction: column;
    `

const CheckoutContainer = styled.div`
    
`

const SectionLogo = styled.img`
    width: 55px;
    height: 50px;
    margin: 10px 5px 10px 10px;
`

const ProjectsTitleLogo = styled.img`
    width: 50px;
    height: 45px;
    margin: 10px;
`
const ProjectsLogo = styled.img`
    width: 50px;
    height: 45px;
    margin: 10px;
    @media all and (max-width: 900px) {
        align-self: center;
    }
`

const Arrow = styled.div`
    &: hover {
        cursor: pointer;
    }
`

const ArrowSymbol = styled.i`
    border: solid black;
    border-width: 0 3px 3px 0;
    display: inline-block;
    padding: 3px;
    transform: ${(props) => props.up ? 'rotate(-135deg)' : 'rotate(45deg)'};
    -webkit-transform: ${(props) => props.up ? 'rotate(-135deg)' : 'rotate(45deg)'};
`

let itemCheckoutList = {}

function DonateItems({ history }) {
    const { user: contextUser, storeUserInContext, removeUserInContext, authToken, setRegisterModal } = useContext(UserContext);
    const [setCalledStatus, checkCalledStatus] = apiCallbackStatus()

    let [donateStatus, setDonateStatus] = useState({ status: false, donateAmount: 0 })
    let [checkout, setCheckout] = useState(false)
    let [modalStatus, setModalStatus] = useState({ status: false, type: PAYMENT_CONFIRMATION, data: null, getToken: null })
    let donateRef = useRef(null)

    const [donationData, donationDataLoading, donationDataError, setDonationDataVariables, setDonationData] = useMutationApi(gql(DONATION_MUTATION))
    const [saplingOptionsData, isGetSaplingOptionsLoading, isGetSaplingOptionsError, refetchSaplingOptionsData] = useQueryApi(gql(GET_SAPLING_OPTIONS), { status: "ACTIVE" })
    const saplingsArray = (saplingOptionsData && saplingOptionsData.getSaplingOptions) || []
    
    const [collapseMap, setCollapseMap] = useState({})
    useEffect(()=> {
        let saplingsArray = (saplingOptionsData && saplingOptionsData.getSaplingOptions) || []
        let map = saplingsArray.reduce((map, sapling) =>{ map[sapling.id] = {collapse: true}; return map;},{})
        setCollapseMap(map)
    }, [saplingOptionsData])

    const getPaymentInfo = () => {
        let donateAmount = donateStatus.donateAmount
        let email = (contextUser && contextUser.email) || ""
        let items = Object.values(itemCheckoutList).map((item) => lodash.pick(item, ['id', 'count', 'saplingName']))
        let input = { email, amount: subTotalCheckoutCost, donationAmount: donateAmount, items }
        return { input, totalAmount: subTotalCheckoutCost + donateAmount }
    }

    const makePaymentFromToken = async (getToken) => {
        let { totalAmount } = getPaymentInfo()
        if (totalAmount)
            setModalStatus({ status: true, type: PAYMENT_CONFIRMATION, data: totalAmount, getToken })
        else
            showToast('Make some selection', 'error')
    }

    const doIt = () => {
        const finalAmount = parseInt(donateRef.current.value);
        if (finalAmount >= MIN_DONATION_VALUE)
            setDonateStatus({ status: true, type: PAYMENT_CONFIRMATION, donateAmount: finalAmount })
        else
            showToast('Minimum of Rs 50 expected', 'error')
    }

    const finalPayment = async () => {
        let getToken = modalStatus.getToken
        let token = await getToken()
        if (!token) {
            showToast('Card info incorrect', 'error')
            closeModal()
            return
        }
        let email = (contextUser && contextUser.email) || ''
        let { input } = getPaymentInfo()
        input = { ...input, email, token: token.id }
        console.log(input, 'input finalPayment')
        setDonationDataVariables({ donationInput: input })
        setCalledStatus(true, DONATION)
        closeModal()
    }

    const closeModal = () => {
        setModalStatus({ status: false, data: null, getToken: null })
    }

    useEffect(() => {
        if (donationData && donationData.data && checkCalledStatus(DONATION)) {
            console.log(donationData, 'wtf payment')
            let referenceId = lodash.get(donationData, 'data.makeDonation.referenceId')
            let error = lodash.get(donationData, 'data.makeDonation.error') || donationDataError
            if (!error && referenceId)
                setModalStatus({ type: PAYMENT_SUCCESS, status: true, data: referenceId })
            else {
                showToast('Problem occured while donating', 'error')
            }
        }
    }, [donationData, donationDataError])

    function checkoutCostChanger(count, val, item) {
        itemCheckoutList[item.saplingName] = { ...item, count }
        console.log(count, itemCheckoutList, 'checkoutCounter');
        setSubTotalCheckoutCost(subTotalCheckoutCost + val);
    }

    let [subTotalCheckoutCost, setSubTotalCheckoutCost] = useState(0);


    const onCheckout = () => {
        let email = contextUser && contextUser.email
        if (!email)
            setRegisterModal(true)
        else
            setCheckout(true)
    }

    const donateText = `## Donate\n\n We will plant trees around you. We have projects coming up across 
                            cities & one of them is bound to be around where you live.
                            \n The saplings are maintained & watered by us for the critical first year.
                         \n\n We will notify you about progress through the plants life.
                         \n You get the geolocation & photo of your sapling once it is planted.`

    const projectsText = `## Projects\n\n `



    return (
        <Donate>
            <Section>
                <SectionLogo src={donateLogoImage}/>
                <Container>
                    <ReactMarkdown source={donateText} />
                </Container>
            </Section>
            <Section>
                <ProjectsTitleLogo src={projectsLogoImage}/>
                <Container>
                    <ReactMarkdown source={projectsText} />
                    <DonateTrees>
                        <DonateItemsContainer>
                            {saplingsArray.map((item) => {
                                let id = item.id, cost = item.saplingCost, name = item.saplingName, image = item.saplingImage, remaining = item.remainingSaplings;
                                let title = 'Roadside trees in Bangalore.'
                                let subtitle = 'Trees in HSR Layout, Kormangala, Whitefield & CBD'
                                let content = 'Total of 7300'
                                return (
                                    <DonateItem key={id}>
                                        {/* <ItemAvatar>
                                            <img style={{ width: 100, height: 100, borderRadius: 50 }} src={image} alt="boohoo" className="img-responsive" />
                                        </ItemAvatar> */}
                                        <ItemContainer>
                                            <ProjectsLogo src={roadProjectsLogoImage}/>
                                            <ItemDetail>
                                                <ItemTitle>{title}</ItemTitle>
                                                <ItemSubtitle >{subtitle}</ItemSubtitle>
                                                
                                                <Collapse isOpened={!(collapseMap[id] && collapseMap[id].collapse)}>
                                                    <ItemDetail>
                                                        <ItemSubtitle>{subtitle}</ItemSubtitle>
                                                        <ItemSubtitle>{subtitle}</ItemSubtitle>
                                                        <ItemSubtitle>{subtitle}</ItemSubtitle>
                                                        <ItemSubtitle>{subtitle}</ItemSubtitle>
                                                        <ItemSubtitle>{subtitle}</ItemSubtitle>
                                                        <ItemSubtitle>{subtitle}</ItemSubtitle>
                                                        <ItemSubtitle>{subtitle}</ItemSubtitle>
                                                        <ItemSubtitle>{subtitle}</ItemSubtitle>
                                                        <ItemSubtitle>{subtitle}</ItemSubtitle>
                                                        <ItemSubtitle>{subtitle}</ItemSubtitle>
                                                        <ItemSubtitle>{subtitle}</ItemSubtitle>
                                                        <ItemSubtitle>{subtitle}</ItemSubtitle>
                                                    </ItemDetail>
                                                </Collapse>
                                                
                                            </ItemDetail>
                                            <CostContainer>
                                                <ItemCost>{`Rs. ${cost} per tree`}</ItemCost>
                                                <Counter maximumCount={remaining} itemCost={(count, itemChangeCost) => checkoutCostChanger(count, itemChangeCost, item)} cost={cost} />
                                            </CostContainer>
                                        </ItemContainer>
                                        <Arrow onClick={() => setCollapseMap({ ...collapseMap, [id]: { collapse: !collapseMap[id].collapse } })}>
                                            <ArrowSymbol up={collapseMap[id] ? !collapseMap[id].collapse : false}/>
                                        </Arrow>
                                    </DonateItem>
                                )
                            })}
                            {/* {getDonateItems(saplingsArray, checkoutCostChanger)} */}
                        </DonateItemsContainer>
                        <CheckoutContainer>
                        {checkout ? (
                            <StripeProvider apiKey={STRIPE_PUBLIC_KEY}>
                                <Checkout onSubmit={(getToken) => makePaymentFromToken(getToken)} />
                            </StripeProvider>
                        ) :
                        <Button disabled={subTotalCheckoutCost==0} onClick={()=> onCheckout()}> Checkout </Button>}
                        </CheckoutContainer>
                    </DonateTrees>

                </Container>
            </Section>
        </Donate>)
    {/* <Donate>
             <DonateTrees>
                <DonateItemsContainer>
                    {getDonateItems(saplingsArray, checkoutCostChanger)}
                </DonateItemsContainer>
                <Subtotal> Subtotal: Rs {subTotalCheckoutCost}</Subtotal>
            </DonateTrees>
            <Or>
                OR
            </Or>
            <DonateMoney>
                {
                    donateStatus.status ?
                        <>
                            <>I would like to donate Rs {donateStatus.donateAmount}</>
                            <Button onClick={() => setDonateStatus({ status: false, donateAmount: 0 })}> Reset </Button>
                        </> :
                        <>
                            <MoneyLine>You could choose the amount you want to donate.</MoneyLine>
                            <Input ref={donateRef} numberInputWidth={'50px'} type="number" defaultValue={MIN_DONATION_VALUE} />
                            <Button onClick={() => { doIt() }}> Lets do it! </Button>
                        </>
                }
            </DonateMoney>
            <StripeProvider apiKey={STRIPE_PUBLIC_KEY}>
                <Checkout onSubmit={(getToken) => makePaymentFromToken(getToken)} />
            </StripeProvider>
            <Modal isOpen={modalStatus.status}
                onAfterOpen={() => { }}
                onRequestClose={() => closeModal()}
                style={customStyle(modalStatus.type)}
                contentLabel={'Hey Man'}
            >
                {modalStatus.type === PAYMENT_CONFIRMATION && <div>
                    <ModalText>
                        Lets make a total donation of Rs {modalStatus.data}
                    </ModalText>
                    <Button onClick={() => finalPayment()}>Go ahead</Button>

                </div>}

                {modalStatus.type === PAYMENT_SUCCESS && <div>
                    <ModalText>
                        Thanks for donating for such a cause.
                        Please note the referenceId for further queries. (Ref id: {modalStatus.data})
                    </ModalText>
                </div>}
            </Modal> 
        </Donate >*/}

    // )
}
export default withRouter(DonateItems)