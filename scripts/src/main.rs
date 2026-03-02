use anyhow::Result;
use fastcrypto::encoding::{Base64, Encoding};
use iota_sdk::json::IotaJsonValue;
use iota_sdk::rpc_types::{IotaTransactionBlockResponseOptions, IotaTypeTag};
use iota_sdk::types::base_types::{IotaAddress, ObjectID};
use iota_sdk::IotaClientBuilder;
use iota_types::base_types::SequenceNumber;
use iota_types::move_authenticator::MoveAuthenticator;
use iota_types::quorum_driver_types::ExecuteTransactionRequestType;
use iota_types::signature::GenericSignature;
use iota_types::transaction::{
    CallArg, SenderSignedData, Transaction, TransactionDataAPI,
};
use std::io::stdin;
use std::io::{stdout, Write};
use std::str::FromStr;
use std::vec;

const MODULE: &str = "transfer";
const FUNCTION: &str = "public_transfer";

#[tokio::main]
async fn main() -> Result<()> {
    let client = IotaClientBuilder::default().build_localnet().await?;

    let builder = client.transaction_builder();

    let signer = IotaAddress::from_str(&std::env::var("ACCOUNT_ADDRESS")?)?;
    let package_object_id = ObjectID::from_str("0x2")?;
    let call_args = vec![
        IotaJsonValue::from_object_id(ObjectID::from_str(&std::env::var("COIN_TO_SEND")?)?),
        IotaJsonValue::from_object_id(ObjectID::from_str(&std::env::var("RECIPIENT")?)?),
    ];
    let gas = ObjectID::from_str(&std::env::var("GAS_COIN")?)?;
    let gas_budget = 10000000;

    let mut data = builder
        .move_call(
            signer,
            package_object_id,
            MODULE,
            FUNCTION,
            vec![IotaTypeTag::new(
                "0x2::coin::Coin<0x2::iota::IOTA>".to_string(),
            )],
            call_args,
            gas,
            gas_budget,
            client.governance_api().get_reference_gas_price().await?,
        )
        .await?;
    // Get the ProgrammableTransaction from data
    let kind = data.kind_mut();

    // // If kind is a ProgrammableTransaction, you can add inputs like this:
    // if let iota_types::transaction::TransactionKind::ProgrammableTransaction(pt) = kind {
    //     // Add a Shared Object input
    //     pt.inputs.push(CallArg::Object(
    //         iota_types::transaction::ObjectArg::SharedObject {
    //             id: ObjectID::from_str(&std::env::var("ACCOUNT_ADDRESS")?)?,
    //             initial_shared_version: SequenceNumber::from_u64(
    //                             std::env::var("INIT")?.parse()?,
    //                         ),
    //             mutable: false,
    //         },
    //     ));
    // }

    println!("TX digest as Vec<u8>: {:?}", data.digest().into_inner());
    println!("TX digest base58: {}\n", data.digest().to_string());

    let ser = Base64::encode(bcs::to_bytes(&data)?);

    println!("Base64 bcs serilaized TxData data: {:#?}\n", ser);

    let ss_tx = SenderSignedData::new(data.clone(), vec![]);

    let ser = Base64::encode(bcs::to_bytes(&ss_tx)?);

    println!("Base64 bcs serilaized SenderSignedData data: {:#?}\n", ser);

    let _ = stdout().flush();
    stdin().read_line(&mut String::new()).unwrap();

    // submit the transaction
    let res = client
        .quorum_driver_api()
        .execute_transaction_block(
            Transaction::from_generic_sig_data(
                data,
                vec![GenericSignature::MoveAuthenticator(
                    MoveAuthenticator::new_v1(
                        vec![],
                        vec![],
                        CallArg::Object(iota_types::transaction::ObjectArg::SharedObject {
                            id: ObjectID::from_str(&std::env::var("ACCOUNT_ADDRESS")?)?,
                            initial_shared_version: SequenceNumber::from_u64(
                                std::env::var("INIT")?.parse()?,
                            ),
                            mutable: false,
                        }),
                    ),
                )],
            ),
            IotaTransactionBlockResponseOptions::full_content(),
            ExecuteTransactionRequestType::WaitForLocalExecution,
        )
        .await?;

    print!("Transaction block executed: {:#?}\n", res);
    Ok(())
}
